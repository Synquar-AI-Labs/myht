import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
it.each(['false', 'true'])('config disables staging logging without changing local defaults (%s)', async local => {
  vi.stubEnv('NATIVE_LOCAL', local);
  vi.resetModules();
  const { default: config } = await import('../../capacitor.config');
  expect(config.loggingBehavior).toBe(local === 'true' ? undefined : 'none');
});
