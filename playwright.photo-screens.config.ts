import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base, testIgnore: [], testMatch: '**/photo-screens.spec.ts', timeout: 180_000,
  outputDir: 'test-results/photo-screens-run', reporter: [['list']],
});
