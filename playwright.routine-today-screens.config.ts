import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base, testIgnore: [], testMatch: '**/routine-today-screens.spec.ts', outputDir:'test-results/routine-today-run', reporter:[['list']] });
