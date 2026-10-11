import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { scanArtifact } from './staging-artifact.mjs';

try {
  const receipt = JSON.parse(readFileSync('.staging-build.json', 'utf8'));
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (receipt.head !== head) throw new Error('Rebuild staging from the current HEAD.');
  const dirty = execFileSync('git', ['diff', 'HEAD', '--name-only'], { encoding: 'utf8' }).trim().split('\n').filter(name => name && name !== 'AGENTS.md');
  if (dirty.length) throw new Error('Commit intended changes, then rebuild staging.');
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'src', 'public', 'scripts', 'index.html', 'vite.config.ts'], { encoding: 'utf8' }).trim();
  if (untracked) throw new Error('Untracked build inputs must be committed before uploading.');
  const artifact = scanArtifact('dist-staging');
  if (receipt.digest !== artifact.digest || receipt.host !== artifact.host) throw new Error('Artifact changed since its successful build scan.');
  console.log(`Verified staging artifact at ${head}: ${artifact.host}`);
} catch (error) { console.error(`REFUSED: ${error.message}`); process.exit(1); }
