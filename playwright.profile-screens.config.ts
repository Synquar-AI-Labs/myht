import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({ ...base, testIgnore: [], testMatch: '**/profile-screens.spec.ts', outputDir: 'test-results/profile-run', reporter: [['list']] });
