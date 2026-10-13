import { expect, it } from 'vitest';
import { releaseGuard, exportGuard } from '../../scripts/native-ios-release.mjs';
import { isReleaseTreeClean, assertReleaseBuild } from '../../scripts/native-release-tree.mjs';

const staging = { target: 'staging', head: 'now', clean: true };

it('refuses local assets before signing or uploading', () => {
  for (const command of ['archive', 'export', 'upload']) expect(() => releaseGuard(command, { target: 'local' }, {})).toThrow('staging');
});
it('requires an environment team id for both commands', () => {
  for (const command of ['archive', 'export', 'upload']) {
    for (const IOS_TEAM_ID of [undefined, 'short', 'ABCDEFGHI!']) expect(() => releaseGuard(command, staging, { IOS_TEAM_ID })).toThrow('IOS_TEAM_ID');
  }
});
it('requires explicit confirmation for upload only', () => {
  const env = { IOS_TEAM_ID: 'ABCDEFGHIJ' };
  expect(releaseGuard('archive', staging, env)).toBe(env.IOS_TEAM_ID);
  expect(releaseGuard('export', staging, env)).toBe(env.IOS_TEAM_ID);
  expect(() => releaseGuard('upload', staging, env)).toThrow('TESTFLIGHT_CONFIRM');
  expect(() => releaseGuard('upload', staging, { ...env, TESTFLIGHT_CONFIRM: 'other' })).toThrow();
  expect(releaseGuard('upload', staging, { ...env, TESTFLIGHT_CONFIRM: 'com.fahadakbar.myht' })).toBe(env.IOS_TEAM_ID);
});
it('all iOS release commands require clean build and current trees', () => {
  const env = { IOS_TEAM_ID: 'ABCDEFGHIJ', TESTFLIGHT_CONFIRM: 'com.fahadakbar.myht' };
  for (const command of ['archive', 'export', 'upload']) {
    expect(() => releaseGuard(command, { ...staging, clean: false }, env, 'now', '')).toThrow('Commit');
    expect(() => releaseGuard(command, staging, env, 'now', ' M src/App.tsx\n')).toThrow('Commit');
    expect(() => releaseGuard(command, staging, env, 'later', '')).toThrow('commit');
    expect(releaseGuard(command, staging, env, 'now', ' M AGENTS.md\n')).toBe(env.IOS_TEAM_ID);
  }
});
it('only an empty tree or the unstaged memory file is allowed', () => {
  for (const status of ['', ' M AGENTS.md\n']) expect(isReleaseTreeClean(status)).toBe(true);
  for (const status of ['M  AGENTS.md\n', ' M AGENTS.md\n?? src/new.ts\n', ' M package.json\n']) expect(isReleaseTreeClean(status)).toBe(false);
  expect(() => assertReleaseBuild({ ...staging, clean: undefined }, 'now', '')).toThrow('Commit');
});
it('upload requires a verified export of the same commit and unchanged artifacts', () => {
  const proof = { commit: 'current', ipaHash: 'ipa', archiveHash: 'archive' };
  expect(() => exportGuard(undefined, 'current', 'ipa', 'archive')).toThrow();
  expect(() => exportGuard(proof, 'other', 'ipa', 'archive')).toThrow();
  expect(() => exportGuard(proof, 'current', 'changed', 'archive')).toThrow();
  expect(() => exportGuard(proof, 'current', 'ipa', 'changed')).toThrow();
  expect(() => exportGuard(proof, 'current', 'ipa', 'archive')).not.toThrow();
});
