import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: '**/screens.spec.ts',
  timeout: 180_000,
  outputDir: 'test-results/screens-run',
  reporter: [['list']],
});
