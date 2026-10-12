import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// Code-native placeholder artwork, not a downloaded logo. No network requests.
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort());
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#faf7f2"/><rect x="180" y="180" width="664" height="664" rx="150" fill="#8a6240"/><path d="M300 520h120l60-120 75 230 55-110h115" fill="none" stroke="#faf7f2" stroke-width="40" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  await page.setContent(`<style>body{margin:0}svg{width:100vw;height:100vh}</style>${svg}`);
  await page.setViewportSize({ width: 1024, height: 1024 });
  await page.screenshot({ path: 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png' });
  for (const [density, size] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
    const folder = `android/app/src/main/res/mipmap-${density}`; mkdirSync(folder, { recursive: true });
    await page.setViewportSize({ width: size, height: size });
    for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) await page.screenshot({ path: `${folder}/${name}` });
  }
  await page.setViewportSize({ width: 2732, height: 2732 });
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) await page.screenshot({ path: `ios/App/App/Assets.xcassets/Splash.imageset/${name}` });
} finally { await browser.close(); }
