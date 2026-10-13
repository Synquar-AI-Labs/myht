import { expect, it } from 'vitest';
import { phoneBuild, nativeUpdateDecision } from '@/lib/nativeUpdate';

it('reads only a whole, safe build number from the phone', () => {
  expect(phoneBuild({ build: '372' })).toBe(372);
  for (const build of ['', '1.0', '-1', 'NaN', '9007199254740993']) expect(phoneBuild({ build })).toBeNull();
  expect(phoneBuild(null)).toBeNull();
});
it('prompts an old app, waits for work, and accepts equal/newer builds', () => {
  expect(nativeUpdateDecision(371, 372, false)).toBe('block');
  expect(nativeUpdateDecision(371, 372, true)).toBe('wait');
  expect(nativeUpdateDecision(372, 372, false)).toBe('allow');
  expect(nativeUpdateDecision(373, 372, true)).toBe('allow');
});
it('missing or invalid answers fail open', () => {
  for (const minimum of [undefined, null, '372', -1, 1.5, NaN, Infinity]) expect(nativeUpdateDecision(1, minimum, false)).toBe('allow');
  expect(nativeUpdateDecision(null, 372, false)).toBe('allow');
});
