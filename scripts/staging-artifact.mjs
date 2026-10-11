import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

export const stagingHost = 'lefqfxkvujqnukgzaviz.supabase.co';
export function scanArtifact(root) {
  const hash = createHash('sha256');
  const hosts = new Set();
  function walk(dir) {
    for (const name of readdirSync(dir).sort()) {
      const file = join(dir, name);
      const stat = lstatSync(file);
      if (stat.isSymbolicLink()) throw new Error('Artifact contains a symbolic link.');
      if (stat.isDirectory()) { walk(file); continue; }
      const bytes = readFileSync(file);
      const text = bytes.toString('utf8');
      for (const forbidden of ['fvasmrdtzqhswhowlydx', '127.0.0.1', 'localhost:54321']) {
        if (text.includes(forbidden)) throw new Error(`Forbidden target in ${relative(root, file)}: ${forbidden}`);
      }
      for (const match of text.matchAll(/https:\/\/([a-z0-9-]+\.supabase\.co)/g)) hosts.add(match[1]);
      hash.update(relative(root, file)).update('\0').update(bytes).update('\0');
    }
  }
  walk(root);
  if (hosts.size !== 1 || !hosts.has(stagingHost)) throw new Error('Artifact must contain only the staging Supabase host.');
  if (lstatSync(join(root, 'index.html')).isDirectory()) throw new Error('Missing app index.');
  // Pages provides SPA fallback when no top-level 404.html exists.
  if (readdirSync(root).includes('404.html')) throw new Error('404.html would disable Pages SPA fallback.');
  return { digest: hash.digest('hex'), host: stagingHost };
}
