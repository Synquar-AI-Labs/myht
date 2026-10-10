import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInvalidationBatcher } from '@/lib/invalidationBatcher';

describe('invalidation batcher', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('flushes a 1000-event burst once per distinct key after quiet', () => {
    const invalidate = vi.fn();
    const batcher = createInvalidationBatcher(invalidate);
    for (let i = 0; i < 1000; i++) batcher.queue([i % 2 ? 'medicines' : 'health_records']);
    vi.advanceTimersByTime(399);
    expect(invalidate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(invalidate.mock.calls).toEqual([[['health_records']], [['medicines']]]);
    vi.advanceTimersByTime(2000);
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('flushes a steady 300ms trickle by the 2s maximum wait', () => {
    const invalidate = vi.fn();
    const batcher = createInvalidationBatcher(invalidate);
    batcher.queue(['medicines']);
    for (let i = 0; i < 6; i++) {
      vi.advanceTimersByTime(300);
      batcher.queue(['medicines']);
    }
    vi.advanceTimersByTime(199);
    expect(invalidate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(invalidate).toHaveBeenCalledExactlyOnceWith(['medicines']);
    batcher.cancel();
  });

  it('cancel prevents a pending flush', () => {
    const invalidate = vi.fn();
    const batcher = createInvalidationBatcher(invalidate);
    batcher.queue(['medicines']);
    batcher.cancel();
    vi.advanceTimersByTime(3000);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
