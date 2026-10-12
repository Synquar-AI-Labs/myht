import { describe, it, expect } from 'vitest';
import { updateDecision, isBuildVersion } from '@/lib/appUpdate';
const version = { commit: 'synthetic-commit', builtAt: '2026-10-11T12:00:00Z' };
describe('app update decision', () => {
  it('ignores the same build', () => expect(updateDecision(version, version, false)).toBe('ignore'));
  it('reloads a new build while idle', () => expect(updateDecision(version, { ...version, builtAt: 'later' }, false)).toBe('reload'));
  it('waits for unfinished work', () => expect(updateDecision(version, { ...version, commit: 'next' }, true)).toBe('wait'));
  it('ignores failed or malformed checks', () => { expect(updateDecision(version, null, false)).toBe('ignore'); expect(updateDecision(version, {}, true)).toBe('ignore'); });
  it('does not accept missing, blank or non-string version fields', () => {
    expect(isBuildVersion(version)).toBe(true);
    expect(isBuildVersion({ commit: '', builtAt: 'later' })).toBe(false);
    expect(isBuildVersion({ commit: 1, builtAt: 'later' })).toBe(false);
  });
});
