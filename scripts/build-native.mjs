import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { execFileSync } from 'node:child_process';
import { nativeTarget, scanNative, assertStagingSecurity } from './native-target.mjs';
import { cleanTrackedTransport } from './native-transport.mjs';
import { isReleaseTreeClean } from './native-release-tree.mjs';

const target = process.argv[2];
if (!['local', 'staging'].includes(target)) throw new Error('Use local or staging.');
rmSync('.native-build.json', { force: true });
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const clean = isReleaseTreeClean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }));
const stack = target === 'local' ? JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8' })) : null;
if (stack && stack.API_URL !== 'http://127.0.0.1:54321') throw new Error('Local stack only.');
const staging = target === 'staging' ? parseEnv(readFileSync('.env.staging.local', 'utf8')) : null;
for (const platform of ['ios', 'android']) {
  const values = staging ?? { VITE_SUPABASE_URL: platform === 'ios' ? stack.API_URL : 'http://10.0.2.2:54321', VITE_SUPABASE_PUBLISHABLE_KEY: stack.ANON_KEY };
  const { url, website } = nativeTarget(target, platform, values);
  const output = `dist-native-${target}-${platform}`;
  const env = { ...process.env, ...values, NATIVE_LOCAL: String(target === 'local'), VITE_NATIVE_APP: 'true', VITE_APP_WEBSITE_URL: website, VITE_SUPABASE_URL: url, VITE_SUPABASE_PROJECT_ID: target === 'local' ? 'myht' : 'lefqfxkvujqnukgzaviz', NATIVE_WEB_DIR: output };
  execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', `native-${target}`, '--outDir', output], { stdio: 'inherit', env });
  scanNative(output, target, platform);
  if (target === 'staging') execFileSync(process.execPath, ['scripts/test/static-staging.mjs', output], { stdio: 'inherit' });
  if (!existsSync(platform)) execFileSync(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', 'add', platform], { stdio: 'inherit', env });
  execFileSync(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', 'sync', platform], { stdio: 'inherit', env });
  // Asset generation never leaves a local allowance in a tracked file.
  // Only the simulator/emulator compiler applies it, within a try/finally.
  cleanTrackedTransport(platform);
  console.log(`PASS native ${target} ${platform}: ${url}`);
}
if (target === 'staging') {
  for (const file of ['ios/App/App/capacitor.config.json', 'android/app/src/main/assets/capacitor.config.json']) {
    assertStagingSecurity(readFileSync('ios/App/App/Info.plist', 'utf8'), readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8'), JSON.parse(readFileSync(file, 'utf8')));
  }
  console.log('PASS staging native projects: no local addresses or transport allowances.');
}
writeFileSync('.native-build.json', JSON.stringify({ target, head, clean: clean && head === execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() && isReleaseTreeClean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })) }));
