import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const events = vi.hoisted(() => ({
  refresh: vi.fn(), change: null as null | ((payload: unknown) => void),
  status: null as null | ((status: string) => void), remove: vi.fn(),
}));
vi.mock('@/hooks/HouseholdProvider', () => ({ useHousehold: () => ({ householdId: 'family', refresh: events.refresh }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  channel: () => {
    const channel = {
      on: (_event: string, _filter: unknown, callback: (payload: unknown) => void) => { events.change = callback; return channel; },
      subscribe: (callback: (status: string) => void) => { events.status = callback; return channel; },
    };
    return channel;
  }, removeChannel: events.remove,
} }));
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

function Sync() { useRealtimeSync(); return null; }
function show() {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const view = render(<QueryClientProvider client={client}><Sync /></QueryClientProvider>);
  return { invalidate, ...view };
}
beforeEach(() => { vi.useFakeTimers(); events.refresh.mockReset(); events.remove.mockReset(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it('batches people events and refreshes on reconnect, not first subscribe', () => {
  const { invalidate } = show();
  act(() => { events.status?.('SUBSCRIBED'); vi.advanceTimersByTime(400); });
  expect(events.refresh).not.toHaveBeenCalled();
  act(() => {
    for (const table_name of ['households', 'household_members', 'caregivers', 'household_invites']) events.change?.({ new: { table_name } });
    vi.advanceTimersByTime(400);
  });
  expect(events.refresh).toHaveBeenCalledTimes(1);
  expect(invalidate).toHaveBeenCalledTimes(1);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['household', 'family', 'household_invites'] });
  act(() => { events.status?.('SUBSCRIBED'); vi.advanceTimersByTime(400); });
  expect(events.refresh).toHaveBeenCalledTimes(2);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['household', 'family'] });
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
