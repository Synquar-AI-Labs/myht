import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scanArtifact, stagingHost } from './staging-artifact.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
rmSync('.staging-build.json', { force: true });
try {
  const env = parseEnv(readFileSync('.env.staging.local', 'utf8'));
  if (env.VITE_SUPABASE_URL !== `https://${stagingHost}`) throw new Error('URL must be exactly the staging URL.');
  if (!env.VITE_SUPABASE_PUBLISHABLE_KEY || /PLACEHOLDER|REPLACE/i.test(env.VITE_SUPABASE_PUBLISHABLE_KEY)) throw new Error('Staging publishable key is missing.');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'staging', '--outDir', 'dist-staging'], {
    stdio: 'inherit', env: { ...process.env, ...env, VITE_SUPABASE_PROJECT_ID: stagingHost.split('.')[0] },
  });
  const artifact = scanArtifact('dist-staging');
  writeFileSync('.staging-build.json', JSON.stringify({ head, ...artifact }) + '\n');
  console.log(`Scanned Supabase host: ${artifact.host}`);
} catch (error) { console.error(`REFUSED: ${error.message}`); process.exit(1); }
