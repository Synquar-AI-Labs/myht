import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';

const ref = 'lefqfxkvujqnukgzaviz';
let env;
try { env = parseEnv(readFileSync(new URL('../.env.staging.local', import.meta.url), 'utf8')); }
catch { console.error('REFUSED: create .env.staging.local using docs/STAGING.md.'); process.exit(1); }
if (env.VITE_SUPABASE_URL?.includes('fvasmrdtzqhswhowlydx') || env.VITE_SUPABASE_URL !== `https://${ref}.supabase.co`) {
  console.error('REFUSED: VITE_SUPABASE_URL must point only to myht-staging.'); process.exit(1);
}
if (!env.VITE_SUPABASE_PUBLISHABLE_KEY || /PLACEHOLDER|REPLACE/i.test(env.VITE_SUPABASE_PUBLISHABLE_KEY)) {
  console.error('REFUSED: add the staging publishable key to .env.staging.local.'); process.exit(1);
}
const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--mode', 'staging', '--host', 'localhost', '--port', '5188', '--strictPort'], {
  cwd: new URL('..', import.meta.url), stdio: 'inherit',
  env: { ...process.env, ...env, VITE_SUPABASE_PROJECT_ID: ref },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { process.exitCode = code ?? 1; });
