import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const events = vi.hoisted(() => ({
  refresh: vi.fn(), change: null as null | ((payload: unknown) => void),
  status: null as null | ((status: string) => void), remove: vi.fn(), channels: vi.fn(), read: vi.fn(),
}));
vi.mock('@/hooks/HouseholdProvider', () => ({ useHousehold: () => ({ householdId: 'family', refresh: events.refresh }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  channel: (name: string) => {
    events.channels(name);
    const channel = {
      on: (_event: string, _filter: unknown, callback: (payload: unknown) => void) => { events.change = callback; return channel; },
      subscribe: (callback: (status: string) => void) => { events.status = callback; return channel; },
    };
    return channel;
  }, removeChannel: events.remove,
  from: () => ({ select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: events.read }) }) }) }),
} }));
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

function Sync() { useRealtimeSync(); return null; }
function show() {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const view = render(<QueryClientProvider client={client}><Sync /></QueryClientProvider>);
  return { invalidate, ...view };
}
beforeEach(() => { vi.useFakeTimers(); events.refresh.mockReset(); events.remove.mockReset(); events.channels.mockReset(); events.read.mockReset(); events.read.mockResolvedValue({ data: { seq: 0 }, error: null }); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it('batches consecutive people events and reads the ticker on subscribe', async () => {
  const { invalidate } = show();
  await act(async () => {});
  await act(async () => { events.status?.('SUBSCRIBED'); vi.advanceTimersByTime(400); });
  expect(events.refresh).not.toHaveBeenCalled();
  act(() => {
    let seq = 0;
    for (const table_name of ['households', 'household_members', 'caregivers', 'household_invites']) events.change?.({ new: { table_name, seq: ++seq } });
    vi.advanceTimersByTime(400);
  });
  expect(events.refresh).toHaveBeenCalledTimes(1);
  expect(invalidate).toHaveBeenCalledTimes(1);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['household', 'family', 'household_invites'] });
  events.read.mockResolvedValue({ data: { seq: 5 }, error: null });
  await act(async () => { events.status?.('SUBSCRIBED'); });
  act(() => { vi.advanceTimersByTime(400); });
  expect(events.refresh).toHaveBeenCalledTimes(2);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['household', 'family'] });
});
it('repairs a server close with bounded backoff, but never repairs its own cleanup', async () => {
  const { unmount } = show(); await act(async () => {});
  const oldStatus = events.status;
  act(() => { oldStatus?.('CLOSED'); oldStatus?.('CHANNEL_ERROR'); vi.advanceTimersByTime(999); });
  expect(events.channels).toHaveBeenCalledTimes(1);
  act(() => { vi.advanceTimersByTime(1); });
  expect(events.channels).toHaveBeenCalledTimes(2);
  const firstName = events.channels.mock.calls[0][0];
  const secondName = events.channels.mock.calls[1][0];
  expect(firstName).toMatch(/^household-sync-family-\d+$/);
  expect(secondName).toMatch(/^household-sync-family-\d+$/);
  expect(secondName).not.toBe(firstName);
  await act(async () => { events.status?.('SUBSCRIBED'); });
  expect(events.read).toHaveBeenCalledTimes(2);
  act(() => { events.status?.('TIMED_OUT'); vi.advanceTimersByTime(1000); });
  expect(events.channels).toHaveBeenCalledTimes(3);
  act(() => { events.status?.('CHANNEL_ERROR'); vi.advanceTimersByTime(1000); });
  expect(events.channels).toHaveBeenCalledTimes(3);
  unmount();
  act(() => { events.status?.('CLOSED'); vi.advanceTimersByTime(120_000); });
  expect(events.channels).toHaveBeenCalledTimes(3);
});
it('polling catches silent loss, preserves failed reads, and rebuilds after the grace period', async () => {
  const { invalidate, unmount } = show(); await act(async () => {});
  events.read.mockResolvedValue({ data: null, error: { message: 'offline' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(invalidate).not.toHaveBeenCalled();
  events.read.mockResolvedValue({ data: { seq: 2 }, error: null });
  await act(async () => { await vi.advanceTimersByTimeAsync(30_400); });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['household', 'family'] });
  await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
  expect(events.channels).toHaveBeenCalledTimes(2);
  unmount();
});
it('a slow ticker response never rolls back a newer live event', async () => {
  let resolve!: (value: unknown) => void;
  events.read.mockReturnValue(new Promise(done => { resolve = done; }));
  const { invalidate, unmount } = show();
  act(() => { events.change?.({ new: { seq: 12, table_name: 'medicines' } }); vi.advanceTimersByTime(400); });
  invalidate.mockClear();
  await act(async () => { resolve({ data: { seq: 10 }, error: null }); });
  act(() => { events.change?.({ new: { seq: 13, table_name: 'health_records' } }); vi.advanceTimersByTime(400); });
  expect(invalidate).toHaveBeenCalledTimes(1);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['household', 'family', 'health_records'] });
  unmount();
});
it('a missing event between different tables invalidates the whole family', async () => {
  const { invalidate, unmount } = show(); await act(async () => {});
  act(() => { events.change?.({ new: { seq: 1, table_name: 'health_records' } }); vi.advanceTimersByTime(400); });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['household', 'family', 'health_records'] });
  invalidate.mockClear();
  // Sequence 2 changed a different domain and never arrived.
  act(() => { events.change?.({ new: { seq: 3, table_name: 'medicines' } }); vi.advanceTimersByTime(400); });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['household', 'family'] });
  unmount();
});
it('refreshes when visible and every five minutes, skips hidden tabs and cancels on unmount', () => {
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  const { unmount } = show();
  act(() => { vi.advanceTimersByTime(300_400); });
  expect(events.refresh).not.toHaveBeenCalled();
  visibility.mockReturnValue('visible');
  act(() => { document.dispatchEvent(new Event('visibilitychange')); vi.advanceTimersByTime(400); });
  expect(events.refresh).toHaveBeenCalledTimes(1);
  act(() => { vi.advanceTimersByTime(300_000); });
  expect(events.refresh).toHaveBeenCalledTimes(2);
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  unmount();
  act(() => { vi.advanceTimersByTime(600_000); });
  expect(events.refresh).toHaveBeenCalledTimes(2);
  expect(events.remove).toHaveBeenCalledTimes(1);
});
