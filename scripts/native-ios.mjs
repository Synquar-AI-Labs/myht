import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { scanNative, assertStagingSecurity } from './native-target.mjs';
import { withLocalTransport } from './native-transport.mjs';

const { target } = JSON.parse(readFileSync('.native-build.json', 'utf8'));
if (!['local', 'staging'].includes(target)) throw new Error('Build a native target first.');
scanNative('ios/App/App/public', target, 'ios');
if (target === 'staging') assertStagingSecurity(readFileSync('ios/App/App/Info.plist', 'utf8'), readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8'), JSON.parse(readFileSync('ios/App/App/capacitor.config.json', 'utf8')));
mkdirSync('test-results/native', { recursive: true });
const build = () => execFileSync('xcodebuild', ['-project', 'ios/App/App.xcodeproj', '-scheme', 'App', '-configuration', 'Debug', '-destination', 'generic/platform=iOS Simulator', '-derivedDataPath', resolve('test-results/native/DerivedData'), 'CODE_SIGNING_ALLOWED=NO', 'build'], { stdio: 'inherit' });
if (target === 'local') await withLocalTransport('ios', build);
else build();
console.log('Simulator app: test-results/native/DerivedData/Build/Products/Debug-iphonesimulator/App.app');
