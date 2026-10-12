import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { scanNative, assertStagingSecurity } from './native-target.mjs';
import { withLocalTransport } from './native-transport.mjs';

const javaHome = execFileSync('brew', ['--prefix', 'openjdk@21'], { encoding: 'utf8' }).trim() + '/libexec/openjdk.jdk/Contents/Home';
if (!existsSync(javaHome + '/release') || !/JAVA_VERSION="21\./.test(readFileSync(javaHome + '/release', 'utf8'))) throw new Error('Install openjdk@21 with Homebrew first.');
const { target } = JSON.parse(readFileSync('.native-build.json', 'utf8'));
if (!['local', 'staging'].includes(target)) throw new Error('Build a native target first.');
scanNative('android/app/src/main/assets/public', target, 'android');
if (target === 'staging') assertStagingSecurity(readFileSync('ios/App/App/Info.plist', 'utf8'), readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8'), JSON.parse(readFileSync('android/app/src/main/assets/capacitor.config.json', 'utf8')));
const sdkHome = process.env.ANDROID_HOME ?? join(homedir(), 'Library/Android/sdk');
if (!existsSync(sdkHome)) throw new Error('Install the Android SDK first or set ANDROID_HOME.');
const build = () => execFileSync('./gradlew', ['assembleDebug'], { cwd: 'android', stdio: 'inherit', env: { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdkHome } });
if (target === 'local') await withLocalTransport('android', build);
else build();
