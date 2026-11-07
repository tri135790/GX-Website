import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
const folder = new URL('../outputs/', import.meta.url);
const file = new URL('invitations-typecheck.ts', folder);
await mkdir(folder, { recursive: true });
try {
  const source = (await readFile(new URL('../supabase/functions/invitations/index.ts', import.meta.url), 'utf8'))
    .replace('npm:@supabase/server@1.9.2', '@supabase/server').replace('npm:zod@3.25.76', 'zod')
    .replaceAll(/Deno.env.get\('([^']+)'\)/g, 'process.env.$1');
  await writeFile(file, source);
  const program = ts.createProgram([fileURLToPath(file)], { noEmit: true, strict: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, esModuleInterop: true });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) {
    console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => process.cwd(), getCanonicalFileName: f => f, getNewLine: () => '\n' }));
    process.exitCode = 1;
  } else console.log('Edge Function TypeScript: passed');
} finally {
  await rm(file, { force: true });
}
