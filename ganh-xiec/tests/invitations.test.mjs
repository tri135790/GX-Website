import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import ts from 'typescript';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';

// Execute the actual Edge handler under Node with only its Deno import/env syntax adapted.
test('invitation Edge Function authenticates users and enforces active admin', async t => {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'test-key'; jwk.alg = 'ES256';
  const env = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', SUPABASE_SECRET_KEY: 'sb_secret_test', SUPABASE_JWKS: JSON.stringify({ keys: [jwk] }), APP_URL: 'https://example.github.io/ganh-xiec/' };
  const old = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]]));
  Object.assign(process.env, env);
  const folder = new URL('../outputs/', import.meta.url);
  const file = new URL('invitation-handler-test.mjs', folder);
  await mkdir(folder, { recursive: true });
  const source = (await readFile(new URL('../supabase/functions/invitations/index.ts', import.meta.url), 'utf8'))
    .replace('npm:@supabase/server@1.9.2', '@supabase/server').replace('npm:zod@3.25.76', 'zod')
    .replaceAll(/Deno.env.get\('([^']+)'\)/g, 'process.env.$1');
  await writeFile(file, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  const originalFetch = globalThis.fetch;
  let role = 'admin', active = true, failEmail = false;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url || input.href);
    const method = init.method || 'GET';
    calls.push({ path: url.pathname, method, body: init.body, url: url.href });
    if (url.pathname.endsWith('/profiles')) return Response.json(url.searchParams.has('id') ? { role, active } : []);
    if (url.pathname.endsWith('/invitations')) return method === 'POST' ? Response.json({ id: 'a97c7c12-eaa0-4b9a-b33b-634f1efab940' }) : new Response(null, { status: 204 });
    if (url.pathname.endsWith('/invite')) return failEmail ? Response.json({ msg: 'SMTP unavailable' }, { status: 500 }) : Response.json({ id: 'new-user', email: 'parent@example.com' });
    if (url.pathname.endsWith('/audit_log')) return new Response(null, { status: 201 });
    throw Error(`Unexpected upstream: ${url}`);
  };
  try {
    const { default: handler } = await import(file.href);
    const token = await new SignJWT({ role: 'authenticated' }).setProtectedHeader({ alg: 'ES256', kid: 'test-key' }).setSubject('a97c7c12-eaa0-4b9a-b33b-634f1efab941').setIssuer(`${env.SUPABASE_URL}/auth/v1`).setAudience('authenticated').setIssuedAt().setExpirationTime('5m').sign(privateKey);
    const invoke = (auth, body = { action: 'revoke', id: 'a97c7c12-eaa0-4b9a-b33b-634f1efab940' }, method = 'POST') => handler.fetch(new Request('https://test.supabase.co/functions/v1/invitations', { method, headers: { ...(auth ? { authorization: `Bearer ${auth}` } : {}), 'content-type': 'application/json' }, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) }));
    await t.test('CORS preflight does not invoke database', async () => {
      const res = await invoke(null, undefined, 'OPTIONS');
      assert.ok(res.ok); assert.equal(res.headers.get('access-control-allow-origin'), 'https://example.github.io'); assert.equal(calls.length, 0);
    });
    await t.test('anonymous and invalid tokens are denied before database access', async () => {
      assert.equal((await invoke(null)).status, 401);
      assert.equal((await invoke('invalid')).status, 401);
      assert.equal(calls.length, 0);
    });
    await t.test('employee and disabled admin are denied', async () => {
      role = 'employee'; assert.equal((await invoke(token)).status, 403);
      role = 'admin'; active = false; assert.equal((await invoke(token)).status, 403);
      active = true; assert.ok(calls.every(c => c.path.endsWith('/profiles')));
    });
    await t.test('admin can revoke and malformed input is rejected', async () => {
      assert.equal((await invoke(token, { action: 'invalid' })).status, 400);
      assert.equal((await invoke(token)).status, 200);
      assert.ok(calls.some(c => c.path.endsWith('/invitations') && c.method === 'PATCH'));
    });
    await t.test('invitation uses configured redirect and records audit', async () => {
      assert.equal((await invoke(token, { action: 'invite', email: 'parent@example.com', role: 'admin' })).status, 200);
      const sent = calls.find(c => c.path.endsWith('/invite'));
      assert.equal(new URL(sent.url).searchParams.get('redirect_to'), env.APP_URL);
      assert.ok(calls.some(c => c.path.endsWith('/audit_log')));
    });
    await t.test('SMTP failure revokes newly created invitation', async () => {
      failEmail = true; calls.length = 0;
      assert.equal((await invoke(token, { action: 'invite', email: 'parent@example.com', role: 'admin' })).status, 502);
      assert.ok(calls.at(-1).path.endsWith('/invitations')); assert.equal(calls.at(-1).method, 'PATCH');
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const [k, v] of Object.entries(old)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    await rm(file, { force: true });
  }
});
