import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { scanNative, assertStagingSecurity } from './native-target.mjs';

export function releaseGuard(command, receipt, env) {
  if (!['archive', 'upload'].includes(command)) throw new Error('Use archive or upload.');
  if (receipt.target !== 'staging') throw new Error('Build the staging native target first.');
  if (!/^[A-Z0-9]{10}$/.test(env.IOS_TEAM_ID ?? '')) throw new Error('Set IOS_TEAM_ID to the 10-character Apple team id.');
  if (command === 'upload' && env.TESTFLIGHT_CONFIRM !== 'com.fahadakbar.myht') throw new Error('Set TESTFLIGHT_CONFIRM=com.fahadakbar.myht to upload.');
  return env.IOS_TEAM_ID;
}

function run() {
  const command = process.argv[2];
  const receipt = JSON.parse(readFileSync('.native-build.json', 'utf8'));
  const team = releaseGuard(command, receipt, process.env);
  scanNative('ios/App/App/public', 'staging', 'ios');
  assertStagingSecurity(readFileSync('ios/App/App/Info.plist', 'utf8'), '', JSON.parse(readFileSync('ios/App/App/capacitor.config.json', 'utf8')));
  const archive = resolve('test-results/native/App.xcarchive');
  const version = execFileSync('git', ['rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim();
  if (command === 'archive') {
    execFileSync('xcodebuild', ['-project', 'ios/App/App.xcodeproj', '-scheme', 'App', '-configuration', 'Release', '-destination', 'generic/platform=iOS', '-archivePath', archive, 'archive', `DEVELOPMENT_TEAM=${team}`, `CURRENT_PROJECT_VERSION=${version}`, '-allowProvisioningUpdates'], { stdio: 'inherit' });
    return;
  }
  if (!existsSync(archive)) throw new Error('Archive the staging app before uploading.');
  const temporary = mkdtempSync(join(tmpdir(), 'myht-testflight-'));
  try {
    const options = join(temporary, 'ExportOptions.plist');
    writeFileSync(options, `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>method</key><string>app-store-connect</string>
<key>destination</key><string>upload</string>
<key>signingStyle</key><string>automatic</string>
<key>teamID</key><string>${team}</string>
</dict></plist>`, { mode: 0o600 });
    execFileSync('xcodebuild', ['-exportArchive', '-archivePath', archive, '-exportOptionsPlist', options, '-allowProvisioningUpdates'], { stdio: 'inherit' });
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) run();
