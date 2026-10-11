import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'myht-hosting-')); roots.push(root);
  for (const dir of ['scripts', 'bin', 'dist-staging']) mkdirSync(join(root, dir));
  for (const name of ['hosting.sh', 'hosting-check.mjs', 'staging-artifact.mjs']) writeFileSync(join(root, 'scripts', name), readFileSync('scripts/' + name));
  writeFileSync(join(root, 'bin/git'), '#!/bin/sh\nif [ "$1" = rev-parse ]; then echo test-head; fi\n', { mode: 0o755 });
  writeFileSync(join(root, 'bin/npx'), '#!/bin/sh\nprintf "%s\\n" "$@"\n', { mode: 0o755 });
  writeFileSync(join(root, 'dist-staging/index.html'), 'https://lefqfxkvujqnukgzaviz.supabase.co');
  const env = { ...process.env, PATH: join(root, 'bin') + ':' + process.env.PATH };
  function receipt(head = 'test-head') {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', 'import {scanArtifact} from "./scripts/staging-artifact.mjs"; console.log(JSON.stringify(scanArtifact("dist-staging")))'], { cwd: root, env, encoding: 'utf8' });
    expect(r.status).toBe(0);
    writeFileSync(join(root, '.staging-build.json'), JSON.stringify({ head, ...JSON.parse(r.stdout) }));
  }
  const run = (args: string[], confirm = '') => spawnSync('bash', ['scripts/hosting.sh', ...args], { cwd: root, env: { ...env, HOSTING_CONFIRM: confirm }, encoding: 'utf8' });
  return { root, receipt, run };
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
describe('hosting guard (no real Wrangler)', () => {
  it('allows whoami and refuses extra arguments and unconfirmed deploy', () => {
    const { run } = fixture();
    expect(run(['whoami']).stdout).toContain('wrangler\nwhoami');
    for (const args of [['login'], ['deploy', '--project-name', 'other'], ['whoami', '--anything'], ['deploy']]) expect(run(args).status).toBe(1);
    expect(run(['deploy'], 'other').status).toBe(1);
  });
  it('refuses a wrong build URL before Vite can run', () => {
    const { root } = fixture();
    writeFileSync(join(root, 'scripts/build-staging.mjs'), readFileSync('scripts/build-staging.mjs'));
    for (const url of ['https://fvasmrdtzqhswhowlydx.supabase.co', 'http://127.0.0.1:54321', 'https://another.supabase.co']) {
      writeFileSync(join(root, '.env.staging.local'), `VITE_SUPABASE_URL=${url}\n`);
      const result = spawnSync(process.execPath, ['scripts/build-staging.mjs'], { cwd: root, encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('REFUSED: URL must be exactly the staging URL.');
    }
  });
  it('requires a current receipt and unchanged scanned artifact', () => {
    const { root, receipt, run } = fixture();
    expect(run(['deploy'], 'myht-staging').status).toBe(1);
    receipt('old-head'); expect(run(['deploy'], 'myht-staging').status).toBe(1);
    receipt(); const approved = run(['deploy'], 'myht-staging');
    expect(approved.status).toBe(0);
    expect(approved.stdout).toContain('wrangler\npages\ndeploy\ndist-staging\n--project-name\nmyht-staging\n--branch\nmain');
    writeFileSync(join(root, 'dist-staging/changed.txt'), 'changed');
    expect(run(['deploy'], 'myht-staging').status).toBe(1);
  });
  it('refuses live, local and other Supabase targets even with an existing receipt', () => {
    const { root, receipt, run } = fixture(); receipt();
    for (const value of ['fvasmrdtzqhswhowlydx', '127.0.0.1', 'localhost:54321', 'https://another.supabase.co']) {
      writeFileSync(join(root, 'dist-staging/bad.txt'), value);
      expect(run(['deploy'], 'myht-staging').status).toBe(1);
    }
  });
});
