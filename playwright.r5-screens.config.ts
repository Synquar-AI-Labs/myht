import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base, testIgnore: [], testMatch:'**/r5-screens.spec.ts',outputDir:'test-results/r5-run',reporter:[['list']] });
