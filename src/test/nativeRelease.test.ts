import { expect, it } from 'vitest';
import { releaseGuard } from '../../scripts/native-ios-release.mjs';

it('refuses local assets before signing or uploading', () => {
  for (const command of ['archive', 'upload']) expect(() => releaseGuard(command, { target: 'local' }, {})).toThrow('staging');
});
it('requires an environment team id for both commands', () => {
  for (const command of ['archive', 'upload']) {
    for (const IOS_TEAM_ID of [undefined, 'short', 'ABCDEFGHI!']) expect(() => releaseGuard(command, { target: 'staging' }, { IOS_TEAM_ID })).toThrow('IOS_TEAM_ID');
  }
});
it('requires explicit confirmation for upload only', () => {
  const env = { IOS_TEAM_ID: 'ABCDEFGHIJ' };
  expect(releaseGuard('archive', { target: 'staging' }, env)).toBe(env.IOS_TEAM_ID);
  expect(() => releaseGuard('upload', { target: 'staging' }, env)).toThrow('TESTFLIGHT_CONFIRM');
  expect(() => releaseGuard('upload', { target: 'staging' }, { ...env, TESTFLIGHT_CONFIRM: 'other' })).toThrow();
  expect(releaseGuard('upload', { target: 'staging' }, { ...env, TESTFLIGHT_CONFIRM: 'com.fahadakbar.myht' })).toBe(env.IOS_TEAM_ID);
});
