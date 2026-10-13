import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NativeUpdateGate } from '@/components/NativeUpdateGate';
import { holdUpdateWork } from '@/hooks/useUpdateBusy';

const mock = vi.hoisted(() => ({ platform: 'android', signal: undefined as AbortSignal | undefined, info: vi.fn(), row: vi.fn(), active: undefined as undefined | ((state: { isActive: boolean }) => void) }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => mock.platform } }));
vi.mock('@capacitor/app', () => ({ App: { getInfo: mock.info, addListener: async (_: string, callback: typeof mock.active) => { mock.active = callback; return { remove: vi.fn() }; } } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ abortSignal: (signal: AbortSignal) => { mock.signal = signal; return { maybeSingle: mock.row }; } }) }) }) } }));
beforeEach(() => { mock.info.mockReset(); mock.row.mockReset(); mock.platform = 'android'; mock.info.mockResolvedValue({ id: 'synthetic.package', version: '1.0', build: '372' }); mock.row.mockResolvedValue({ data: { min_build: 0 }, error: null }); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const show = () => render(<QueryClientProvider client={new QueryClient()}><NativeUpdateGate><p>Family screen</p><input aria-label="Draft" defaultValue="saved" /></NativeUpdateGate></QueryClientProvider>);

it('checks before mounting family screens and lower minimum restores them', async () => {
  mock.row.mockResolvedValue({ data: { min_build: 373 }, error: null });
  show();
  expect(screen.queryByText('Family screen')).not.toBeInTheDocument();
  await screen.findByText('Update needed');
  expect(screen.getByRole('link', { name: 'Open Play Store' })).toHaveAttribute('href', 'https://play.google.com/store/apps/details?id=synthetic.package');
  expect(screen.getByText(/Open the Play Store and tap Update/)).toBeInTheDocument();
  expect(screen.getByText('Version 1.0 (372)')).toBeInTheDocument();
  mock.row.mockResolvedValue({ data: { min_build: 0 }, error: null });
  await act(async () => { mock.active?.({ isActive: true }); });
  await screen.findByText('Family screen');
});
it('held recording/save work keeps the family mounted, then blocks when settled', async () => {
  const release = holdUpdateWork();
  try {
    mock.row.mockResolvedValue({ data: { min_build: 373 }, error: null }); show();
    await screen.findByText('This app needs an update. Finish this first.');
    expect(screen.getByText('Family screen')).toBeInTheDocument();
    act(() => release());
    await screen.findByText('Update needed');
    expect(screen.queryByText('Family screen')).not.toBeInTheDocument();
  } finally { release(); }
});
it('Apple uses the TestFlight scheme rather than loading the landing website', async () => {
  mock.platform = 'ios'; mock.row.mockResolvedValue({ data: { min_build: 373 }, error: null }); show();
  await screen.findByText('Update needed');
  expect(screen.getByRole('link', { name: 'Open TestFlight' })).toHaveAttribute('href', 'itms-beta://');
  expect(screen.getByText(/Open TestFlight and tap Update/)).toBeInTheDocument();
});
it('an open sheet waits until it closes', async () => {
  const sheet = document.createElement('div'); sheet.setAttribute('role', 'dialog'); document.body.append(sheet);
  try {
    mock.row.mockResolvedValue({ data: { min_build: 373 }, error: null }); show();
    await screen.findByText('This app needs an update. Finish this first.');
    act(() => sheet.remove()); await screen.findByText('Update needed');
  } finally { sheet.remove(); }
});
it('read errors never become a lock', async () => {
  mock.row.mockResolvedValue({ data: null, error: { message: 'offline' } }); show();
  await screen.findByText('Family screen'); expect(screen.queryByText('Update needed')).not.toBeInTheDocument();
});
it('unsaved input keeps the screen mounted until restored to its baseline', async () => {
  show(); await screen.findByText('Family screen');
  const field = screen.getByLabelText('Draft');
  fireEvent.focusIn(field); fireEvent.input(field, { target: { value: 'draft' } });
  mock.row.mockResolvedValue({ data: { min_build: 373 }, error: null });
  await act(async () => { mock.active?.({ isActive: true }); });
  await screen.findByText('This app needs an update. Finish this first.');
  expect(field).toHaveValue('draft');
  fireEvent.input(field, { target: { value: 'saved' } });
  await screen.findByText('Update needed');
});
it('a stalled first answer lets the family through after three seconds', async () => {
  vi.useFakeTimers(); mock.row.mockReturnValue(new Promise(() => {})); show();
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  expect(screen.getByText('Family screen')).toBeInTheDocument();
  expect(mock.signal?.aborted).toBe(false);
});
it('a successful update requirement survives a read error, throw and timeout', async () => {
  vi.useFakeTimers(); mock.row.mockResolvedValue({ data: { min_build: 373 }, error: null });
  show(); await act(async () => {});
  expect(screen.getByText('Update needed')).toBeInTheDocument();
  mock.row.mockResolvedValue({ data: null, error: { message: 'offline' } });
  await act(async () => { mock.active?.({ isActive: true }); });
  expect(screen.getByText('Update needed')).toBeInTheDocument();
  mock.row.mockRejectedValue(new Error('network'));
  await act(async () => { mock.active?.({ isActive: true }); });
  expect(screen.getByText('Update needed')).toBeInTheDocument();
  mock.row.mockReturnValue(new Promise(() => {}));
  await act(async () => { mock.active?.({ isActive: true }); });
  await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
  expect(screen.getByText('Update needed')).toBeInTheDocument();
});
it('a five-second answer still blocks after the startup wait has ended', async () => {
  vi.useFakeTimers();
  let answer!: (value: unknown) => void;
  mock.row.mockReturnValue(new Promise(resolve => { answer = resolve; })); show();
  expect(screen.getByText('Loading...')).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  expect(screen.getByText('Family screen')).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); answer({ data: { min_build: 373 }, error: null }); });
  expect(screen.getByText('Update needed')).toBeInTheDocument();
});
it('retries failure at thirty seconds, then returns to ten-minute checks', async () => {
  vi.useFakeTimers(); mock.row.mockResolvedValue({ data: null, error: { message: 'offline' } });
  show(); await act(async () => {}); expect(mock.row).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(29_999); });
  expect(mock.row).toHaveBeenCalledTimes(1);
  mock.row.mockResolvedValue({ data: { min_build: 0 }, error: null });
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(mock.row).toHaveBeenCalledTimes(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(599_999); });
  expect(mock.row).toHaveBeenCalledTimes(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(mock.row).toHaveBeenCalledTimes(3);
});
it('first check runs even if the document initially reports hidden', async () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  show(); await screen.findByText('Family screen'); expect(mock.row).toHaveBeenCalledTimes(1);
});
it('the twenty-second cap aborts and releases the checking flag for a retry', async () => {
  vi.useFakeTimers(); mock.row.mockReturnValue(new Promise(() => {})); show();
  await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
  expect(mock.signal?.aborted).toBe(true);
  mock.row.mockResolvedValue({ data: { min_build: 0 }, error: null });
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(mock.row).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Family screen')).toBeInTheDocument();
});
it('a successfully read missing row removes the previous minimum', async () => {
  mock.row.mockResolvedValue({ data: { min_build: 373 }, error: null }); show();
  await screen.findByText('Update needed');
  mock.row.mockResolvedValue({ data: null, error: null });
  await act(async () => { mock.active?.({ isActive: true }); });
  await screen.findByText('Family screen');
});

it.each([false, true])('rechecks an update requirement in thirty seconds (busy=%s)', async held => {
  vi.useFakeTimers();
  const release = held ? holdUpdateWork() : () => {};
  try {
    mock.row.mockResolvedValue({ data: { min_build: 373 }, error: null });
    show(); await act(async () => {});
    expect(screen.getByText(held ? 'This app needs an update. Finish this first.' : 'Update needed')).toBeInTheDocument();
    mock.row.mockResolvedValue({ data: { min_build: 0 }, error: null });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(mock.row).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Family screen')).toBeInTheDocument();
    expect(screen.queryByText('Update needed')).not.toBeInTheDocument();
    expect(screen.queryByText('This app needs an update. Finish this first.')).not.toBeInTheDocument();
  } finally { act(() => release()); }
});
