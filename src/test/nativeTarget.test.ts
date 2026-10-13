import { describe, expect, it } from 'vitest';
import { nativeTarget, assertStagingSecurity, scanNative } from '../../scripts/native-target.mjs';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withLocalTransport } from '../../scripts/native-transport.mjs';

describe('native target boundary', () => {
  it('allows exactly the matching API host', () => {
    expect(nativeTarget('staging', 'ios', { VITE_SUPABASE_URL: 'https://lefqfxkvujqnukgzaviz.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'public' }).url).toContain('lefqfx');
    expect(nativeTarget('local', 'android', { VITE_SUPABASE_URL: 'http://10.0.2.2:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'public' }).url).toContain('10.0.2.2');
    expect(() => nativeTarget('staging', 'ios', { VITE_SUPABASE_URL: 'http://127.0.0.1:54321' })).toThrow();
    expect(() => nativeTarget('local', 'ios', { VITE_SUPABASE_URL: 'https://lefqfxkvujqnukgzaviz.supabase.co' })).toThrow();
  });
  it('rejects local transport allowances in staging projects', () => {
    expect(() => assertStagingSecurity('<plist/>', '<manifest/>', { loggingBehavior: 'none' })).not.toThrow();
    for (const loggingBehavior of [undefined, 'debug', 'production']) {
      expect(() => assertStagingSecurity('<plist/>', '<manifest/>', { loggingBehavior })).toThrow('plugin logging');
    }
    expect(() => assertStagingSecurity('NSAllowsLocalNetworking', '<manifest/>', { loggingBehavior: 'none' })).toThrow('transport allowance');
    expect(() => assertStagingSecurity('<plist/>', 'android:usesCleartextTraffic="true"', { loggingBehavior: 'none' })).toThrow('transport allowance');
    expect(() => assertStagingSecurity('<plist/>', '<manifest/>', { loggingBehavior: 'none', server: { url: 'http://127.0.0.1' } })).toThrow('navigation allowances');
    expect(() => assertStagingSecurity('<plist/>', '<manifest/>', { loggingBehavior: 'none', server: { androidScheme: 'http' } })).toThrow('HTTP');
    expect(() => assertStagingSecurity('<plist/>', '<manifest/>', { loggingBehavior: 'none', android: { allowMixedContent: true } })).toThrow('HTTP');
    expect(() => assertStagingSecurity('<plist/>', '<manifest/>', { loggingBehavior: 'none', server: { androidScheme: 'https' }, android: { allowMixedContent: false } })).not.toThrow();
  });
  it('scans the artifact itself, refusing foreign hosts and local addresses', () => {
    const root = mkdtempSync(join(tmpdir(), 'myht-native-scan-'));
    try {
      const file = join(root, 'index.html');
      writeFileSync(file, 'https://lefqfxkvujqnukgzaviz.supabase.co');
      expect(() => scanNative(root, 'staging', 'ios')).not.toThrow();
      writeFileSync(file, 'https://lefqfxkvujqnukgzaviz.supabase.co http://10.0.2.2:54321');
      expect(() => scanNative(root, 'staging', 'ios')).toThrow('local endpoint');
      writeFileSync(file, 'https://lefqfxkvujqnukgzaviz.supabase.co https://another-project.supabase.co');
      expect(() => scanNative(root, 'staging', 'ios')).toThrow('only the staging host');
      writeFileSync(file, 'http://127.0.0.1:54321');
      expect(() => scanNative(root, 'local', 'ios')).not.toThrow();
      expect(() => scanNative(root, 'local', 'android')).toThrow();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('restores clean tracked build inputs on both success and failure', async () => {
    const root = mkdtempSync(join(tmpdir(), 'myht-transport-'));
    try {
      for (const platform of ['ios', 'android']) {
        const file = join(root, platform); const clean = platform === 'ios' ? '<plist><dict><key>Name</key><string>test</string></dict></plist>' : '<manifest><application android:allowBackup="false" /></manifest>';
        writeFileSync(file, clean);
        for (const fails of [false, true]) {
          const build = withLocalTransport(platform, () => {
            expect(readFileSync(file, 'utf8')).toContain(platform === 'ios' ? 'NSAllowsLocalNetworking' : 'usesCleartextTraffic="true"');
            if (fails) throw new Error('Compiler failed');
            return 'built';
          }, file);
          if (fails) await expect(build).rejects.toThrow('Compiler failed');
          else expect(await build).toBe('built');
          expect(readFileSync(file, 'utf8')).toBe(clean);
        }
      }
      assertStagingSecurity(readFileSync('ios/App/App/Info.plist', 'utf8'), readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8'), { loggingBehavior: 'none' });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
