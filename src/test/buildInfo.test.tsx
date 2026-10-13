import { render, screen, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { BuildInfo } from '@/components/BuildInfo';
const state = vi.hoisted(() => ({ native: false, info: vi.fn() }));
vi.mock('@/native/platform', () => ({ isNativeApp: () => state.native }));
vi.mock('@capacitor/app', () => ({ App: { getInfo: state.info } }));
beforeEach(() => { state.native = false; state.info.mockResolvedValue({ version: '1.0', build: '372' }); vi.stubEnv('VITE_BUILD_VERSION', JSON.stringify({ commit: 'synthetic123', builtAt: '2026-10-12T12:00:00Z' })); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
it('native version comes from the phone, not the website commit', async () => {
  state.native = true; render(<BuildInfo />);
  await screen.findByText('Version 1.0 (372)');
  expect(screen.queryByText(/synthet/)).not.toBeInTheDocument();
});
it('website displays its short commit and build date without asking the plugin', () => {
  state.info.mockClear(); render(<BuildInfo />);
  expect(screen.getByText('Version synthet · Oct 12, 2026')).toBeInTheDocument();
  expect(state.info).not.toHaveBeenCalled();
});
