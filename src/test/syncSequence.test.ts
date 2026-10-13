import { expect, it } from 'vitest';
import { reconcileSequence } from '@/lib/syncSequence';

it('establishes a read baseline and ignores equal, failed-shaped and late answers', () => {
  expect(reconcileSequence(null, 10, 'read')).toEqual({ seq: 10, action: 'none' });
  for (const next of [10, 9, NaN]) expect(reconcileSequence(10, next, 'read')).toEqual({ seq: 10, action: 'none' });
  expect(reconcileSequence(10, 11, 'read')).toEqual({ seq: 11, action: 'all' });
});
it('refreshes each consecutive table, but all domains on a gap or first event', () => {
  expect(reconcileSequence(null, 10, 'event').action).toBe('all');
  expect(reconcileSequence(10, 11, 'event').action).toBe('table');
  expect(reconcileSequence(11, 12, 'event').action).toBe('table');
  // Reading change 11 was lost; medicine event 12 cannot describe it.
  expect(reconcileSequence(10, 12, 'event')).toEqual({ seq: 12, action: 'all' });
  expect(reconcileSequence(12, 11, 'read')).toEqual({ seq: 12, action: 'none' });
  expect(reconcileSequence(12, 12, 'event').action).toBe('none');
});
