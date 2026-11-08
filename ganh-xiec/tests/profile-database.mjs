// PGLITE_ROOT=/path/to/@electric-sql/pglite node tests/profile-database.mjs
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const root = process.env.PGLITE_ROOT;
if (!root) throw Error('Set PGLITE_ROOT.');
const { PGlite } = await import(pathToFileURL(root + '/dist/index.js'));
const { btree_gist } = await import(pathToFileURL(root + '/dist/contrib/btree_gist.js'));
const db = new PGlite({ extensions: { btree_gist } });
await db.exec(`create role anon; create role authenticated; create schema auth;
grant usage on schema auth to authenticated,anon;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,last_sign_in_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb);`);
for (const file of ['001_ganh_xiec.sql', '003_profile_onboarding.sql']) {
    await db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
}
const ids = {};
for (const role of ['admin', 'employee', 'parents']) {
    const id = crypto.randomUUID(); ids[role] = id;
    const linked = role === 'admin' ? null : crypto.randomUUID();
    if (linked) await db.query(`insert into public.${role === 'employee' ? 'employees' : 'parents'}(id,name) values($1,'Hồ sơ quản lý')`, [linked]);
    await db.query('insert into public.invitations(email,role,employee_id,parent_id) values($1,$2,$3,$4)', [role + '@example.com', role, role === 'employee' ? linked : null, role === 'parents' ? linked : null]);
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [id, role + '@example.com']);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec('set role authenticated');
    const before = (await db.query('select * from public.profiles where id=$1', [id])).rows[0];
    assert.equal(before.onboarding_completed, false);
    await assert.rejects(() => db.query("select public.complete_my_profile('   ')") , /không hợp lệ/);
    await assert.rejects(() => db.query('select public.complete_my_profile($1)', ['x'.repeat(121)]), /không hợp lệ/);
    await db.query('select public.complete_my_profile($1,$2,$3)', [' Tên ' + role + ' ', ' 0901234567 ', ' Địa chỉ thử ']);
    const after = (await db.query('select * from public.profiles where id=$1', [id])).rows[0];
    assert.equal(after.name, 'Tên ' + role); assert.equal(after.phone, '0901234567');
    assert.equal(after.address, 'Địa chỉ thử'); assert.equal(after.onboarding_completed, true);
    for (const field of ['role', 'active', 'email', 'employee_id', 'parent_id']) assert.equal(after[field], before[field]);
    await assert.rejects(() => db.query("update public.profiles set role='admin' where id=$1", [id]), /permission denied/);
    await assert.rejects(() => db.query('select public.complete_my_profile($1,$2,$3,$4)', ['Name', '', '', ids.admin]), /does not exist/);
    await db.exec('reset role');
    if (linked) assert.equal((await db.query(`select name from public.${role === 'employee' ? 'employees' : 'parents'} where id=$1`, [linked])).rows[0].name, 'Hồ sơ quản lý');
    console.log('PASS own profile onboarding: ' + role);
}
const outsider = crypto.randomUUID();
await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [outsider, 'outsider@example.com']);
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [outsider]);
await db.exec('set role authenticated');
await assert.rejects(() => db.query("select public.complete_my_profile('Outsider')"), /chưa được cấp quyền/);
await db.exec('reset role');
await db.query('update public.profiles set active=false where id=$1', [ids.employee]);
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids.employee]);
await db.exec('set role authenticated');
await assert.rejects(() => db.query("select public.complete_my_profile('Locked')"), /bị khóa/);
await db.exec('reset role; set role anon');
await assert.rejects(() => db.query("select public.complete_my_profile('Anonymous')"), /permission denied/);
await db.exec('reset role');
assert.equal((await db.query("select count(*)::int as n from public.audit_log where entity='profiles' and operation='UPDATE' and after_data->>'onboarding_completed'='true'")).rows[0].n, 4);
console.log('PASS anonymous, uninvited, locked users denied; profile changes audited');
await db.close();
