import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base, testIgnore: [], testMatch: '**/routine-screens.spec.ts', outputDir: 'test-results/routine-run', reporter: [['list']] });
