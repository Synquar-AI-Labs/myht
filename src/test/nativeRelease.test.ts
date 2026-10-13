import { expect, it } from 'vitest';
import { releaseGuard, exportGuard } from '../../scripts/native-ios-release.mjs';

it('refuses local assets before signing or uploading', () => {
  for (const command of ['archive', 'export', 'upload']) expect(() => releaseGuard(command, { target: 'local' }, {})).toThrow('staging');
});
it('requires an environment team id for both commands', () => {
  for (const command of ['archive', 'export', 'upload']) {
    for (const IOS_TEAM_ID of [undefined, 'short', 'ABCDEFGHI!']) expect(() => releaseGuard(command, { target: 'staging' }, { IOS_TEAM_ID })).toThrow('IOS_TEAM_ID');
  }
});
it('requires explicit confirmation for upload only', () => {
  const env = { IOS_TEAM_ID: 'ABCDEFGHIJ' };
  expect(releaseGuard('archive', { target: 'staging' }, env)).toBe(env.IOS_TEAM_ID);
  expect(releaseGuard('export', { target: 'staging' }, env)).toBe(env.IOS_TEAM_ID);
  expect(() => releaseGuard('upload', { target: 'staging' }, env)).toThrow('TESTFLIGHT_CONFIRM');
  expect(() => releaseGuard('upload', { target: 'staging' }, { ...env, TESTFLIGHT_CONFIRM: 'other' })).toThrow();
  expect(releaseGuard('upload', { target: 'staging' }, { ...env, TESTFLIGHT_CONFIRM: 'com.fahadakbar.myht' })).toBe(env.IOS_TEAM_ID);
});
it('upload requires a verified export of the same commit and unchanged artifacts', () => {
  const proof = { commit: 'current', ipaHash: 'ipa', archiveHash: 'archive' };
  expect(() => exportGuard(undefined, 'current', 'ipa', 'archive')).toThrow();
  expect(() => exportGuard(proof, 'other', 'ipa', 'archive')).toThrow();
  expect(() => exportGuard(proof, 'current', 'changed', 'archive')).toThrow();
  expect(() => exportGuard(proof, 'current', 'ipa', 'changed')).toThrow();
  expect(() => exportGuard(proof, 'current', 'ipa', 'archive')).not.toThrow();
});
