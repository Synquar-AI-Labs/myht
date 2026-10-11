import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ref = 'lefqfxkvujqnukgzaviz';
const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'myht-staging-guard-')); roots.push(root);
  for (const dir of ['scripts', 'supabase/.temp', 'bin']) mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, 'scripts/staging.sh'), readFileSync('scripts/staging.sh'));
  writeFileSync(join(root, 'supabase/.temp/project-ref'), ref);
  // Never invoke the real CLI: the stand-in only prints arguments, with no network.
  writeFileSync(join(root, 'bin/supabase'), '#!/bin/sh\nprintf "%s\\n" "$@"\n', { mode: 0o755 });
  const run = (args: string[], confirm = '') => spawnSync('bash', [join(root, 'scripts/staging.sh'), ...args], {
    encoding: 'utf8', env: { ...process.env, PATH: join(root, 'bin') + ':' + process.env.PATH, STAGING_CONFIRM: confirm },
  });
  return { root, run };
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
describe('staging command boundary (offline stand-in CLI)', () => {
  it('refuses live, unknown, missing targets and user-supplied overrides', () => {
    const { root, run } = fixture();
    for (const target of ['fvasmrdtzqhswhowlydx', 'another-project']) {
      writeFileSync(join(root, 'supabase/.temp/project-ref'), target);
      expect(run(['migration', 'list', '--linked']).status).toBe(1);
    }
    writeFileSync(join(root, 'supabase/.temp/project-ref'), ref);
    expect(run(['secrets', 'set', 'KEY=value'], ref).status).toBe(1);
    expect(run(['db', 'push', '--linked', '--project-ref=other'], ref).status).toBe(1);
    rmSync(join(root, 'supabase/.temp/project-ref'));
    expect(run(['migration', 'list', '--linked']).status).toBe(1);
  });
  it('requires per-invocation confirmation for each changing command', () => {
    const { run } = fixture();
    for (const args of [['db', 'push', '--linked'], ['db', 'reset', '--linked'], ['functions', 'deploy', 'transcribe-audio'], ['config', 'push']]) {
      expect(run(args).status).toBe(1);
      expect(run(args, 'wrong-ref').status).toBe(1);
      const approved = run(args, ref);
      expect(approved.status).toBe(0);
      expect(approved.stdout).toContain('Staging project: ' + ref);
      if (args[0] === 'config' || args[0] === 'functions') expect(approved.stdout).toContain('--project-ref\n' + ref);
    }
  });
  it('allows only the three listed read-only commands without confirmation', () => {
    const { run } = fixture();
    for (const args of [['migration', 'list', '--linked'], ['db', 'push', '--linked', '--dry-run'], ['secrets', 'list']]) {
      const result = run(args);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Staging project: ' + ref);
    }
  });
  it('adds auto-confirm only to an approved linked reset', () => {
    const { run } = fixture();
    expect(run(['db', 'reset', '--linked']).status).toBe(1);
    expect(run(['db', 'reset', '--linked'], ref).stdout.split('\n')).toContain('--yes');
    for (const args of [['config', 'push'], ['db', 'push', '--linked'], ['functions', 'deploy', 'transcribe-audio']]) {
      expect(run(args, ref).stdout.split('\n')).not.toContain('--yes');
    }
  });
  it('previews with explicit no answers, text output and auto-confirm overridden', () => {
    const { root, run } = fixture();
    writeFileSync(join(root, 'bin/supabase'), '#!/bin/sh\nprintf "%s\\n" "$@"\ni=0\nwhile [ "$i" -lt 10 ]; do\n read -r answer || exit 2\n [ "$answer" = n ] || exit 3\n i=$((i + 1))\ndone\n', { mode: 0o755 });
    const previous = process.env.SUPABASE_YES;
    process.env.SUPABASE_YES = 'true';
    try {
      const result = run(['config', 'preview']);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('--yes=false');
      expect(result.stdout).toContain('--agent\nno\n--output-format\ntext');
      expect(result.stdout).toContain('config\npush\n--project-ref\n' + ref);
    } finally {
      if (previous === undefined) delete process.env.SUPABASE_YES;
      else process.env.SUPABASE_YES = previous;
    }
  });
  it('refuses dev startup for a live, wrong or placeholder environment', () => {
    const { root } = fixture();
    writeFileSync(join(root, 'scripts/dev-staging.mjs'), readFileSync('scripts/dev-staging.mjs'));
    for (const url of ['https://fvasmrdtzqhswhowlydx.supabase.co', 'https://other.supabase.co', `https://${ref}.supabase.co`]) {
      writeFileSync(join(root, '.env.staging.local'), `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_PUBLISHABLE_KEY=REPLACE_WITH_STAGING_PUBLISHABLE_KEY\n`);
      const result = spawnSync(process.execPath, [join(root, 'scripts/dev-staging.mjs')], { encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('REFUSED:');
    }
  });
});
