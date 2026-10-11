import { defineConfig } from '@playwright/test';
import { localStack } from './e2e/local';

const stack = localStack();
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5187',
    browserName: 'chromium',
    headless: true,
    actionTimeout: 15_000,
    viewport: { width: 390, height: 844 },
    timezoneId: 'America/Toronto',
    permissions: ['microphone'],
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5187 --strictPort',
    url: 'http://127.0.0.1:5187',
    reuseExistingServer: false,
    env: {
      ...process.env,
      VITE_SUPABASE_URL: stack.API_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: stack.ANON_KEY,
      VITE_SUPABASE_PROJECT_ID: 'myht',
    },
  },
});
