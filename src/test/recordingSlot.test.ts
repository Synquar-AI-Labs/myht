import { expect, it } from 'vitest';
import { recordingSlot } from '@/lib/recordingJobStore';

it('isolates recording slots by both the user and household', () => {
  const owner = { user_id: 'user-a', household_id: 'family-a' };
  expect(recordingSlot(owner)).toBe('user-a:family-a');
  expect(recordingSlot({ ...owner, user_id: 'user-b' })).not.toBe(recordingSlot(owner));
  expect(recordingSlot({ ...owner, household_id: 'family-b' })).not.toBe(recordingSlot(owner));
});
