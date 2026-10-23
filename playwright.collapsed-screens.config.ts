import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base, testIgnore: [], testMatch: '**/collapsed-screens.spec.ts', outputDir: 'test-results/collapsed-run', reporter: [['list']] });
