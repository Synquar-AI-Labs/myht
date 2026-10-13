import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { scanNative, assertStagingSecurity } from './native-target.mjs';
import { assertReleaseBuild } from './native-release-tree.mjs';

export function releaseGuard(command, receipt, env, head = receipt.head, status = '') {
  if (!['archive', 'export', 'upload'].includes(command)) throw new Error('Use archive, export or upload.');
  if (receipt.target !== 'staging') throw new Error('Build the staging native target first.');
  assertReleaseBuild(receipt, head, status);
  if (!/^[A-Z0-9]{10}$/.test(env.IOS_TEAM_ID ?? '')) throw new Error('Set IOS_TEAM_ID to the 10-character Apple team id.');
  if (command === 'upload' && env.TESTFLIGHT_CONFIRM !== 'com.fahadakbar.myht') throw new Error('Set TESTFLIGHT_CONFIRM=com.fahadakbar.myht to upload.');
  return env.IOS_TEAM_ID;
}

export function exportGuard(receipt, commit, ipaHash, archiveHash) {
  if (!receipt || receipt.commit !== commit || receipt.ipaHash !== ipaHash || receipt.archiveHash !== archiveHash) throw new Error('Export and verify this commit before uploading.');
}

function fingerprint(path) {
  const hash = createHash('sha256');
  const walk = file => {
    if (statSync(file).isDirectory()) for (const name of readdirSync(file).sort()) { hash.update(name); walk(join(file, name)); }
    else hash.update(readFileSync(file));
  };
  walk(path);
  return hash.digest('hex');
}

function verifyIpa(ipa, temporary) {
  const extracted = join(temporary, 'ipa');
  execFileSync('unzip', ['-q', ipa, '-d', extracted]);
  const payload = join(extracted, 'Payload');
  const apps = readdirSync(payload).filter(name => name.endsWith('.app'));
  if (apps.length !== 1) throw new Error('Expected exactly one exported app.');
  const app = join(payload, apps[0]);
  const plistPath = join(app, 'Info.plist');
  const plist = execFileSync('plutil', ['-convert', 'xml1', '-o', '-', plistPath], { encoding: 'utf8' });
  const info = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', plistPath], { encoding: 'utf8' }));
  if (info.ITSAppUsesNonExemptEncryption !== false) throw new Error('Export must declare no non-exempt encryption.');
  const config = JSON.parse(readFileSync(join(app, 'capacitor.config.json'), 'utf8'));
  if (config.server !== undefined) throw new Error('Export must not contain a server block.');
  scanNative(join(app, 'public'), 'staging', 'ios');
  assertStagingSecurity(plist, '', config);
  console.log('PASS exported IPA: staging assets, no server/local transport allowance, encryption declaration false.');
}

function run() {
  const command = process.argv[2];
  const receipt = JSON.parse(readFileSync('.native-build.json', 'utf8'));
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const team = releaseGuard(command, receipt, process.env, commit, execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }));
  scanNative('ios/App/App/public', 'staging', 'ios');
  assertStagingSecurity(readFileSync('ios/App/App/Info.plist', 'utf8'), '', JSON.parse(readFileSync('ios/App/App/capacitor.config.json', 'utf8')));
  const archive = resolve('test-results/native/App.xcarchive');
  const exported = resolve('test-results/native/export');
  const proof = join(exported, 'verified.json');
  const version = execFileSync('git', ['rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim();
  if (command === 'archive') {
    rmSync(proof, { force: true });
    execFileSync('xcodebuild', ['-project', 'ios/App/App.xcodeproj', '-scheme', 'App', '-configuration', 'Release', '-destination', 'generic/platform=iOS', '-archivePath', archive, 'archive', `DEVELOPMENT_TEAM=${team}`, `CURRENT_PROJECT_VERSION=${version}`, 'CODE_SIGNING_ALLOWED=NO', 'CODE_SIGNING_REQUIRED=NO', 'CODE_SIGN_IDENTITY='], { stdio: 'inherit' });
    return;
  }
  if (!existsSync(archive)) throw new Error('Archive the staging app before exporting or uploading.');
  let ipa;
  if (command === 'upload') {
    if (!existsSync(proof)) throw new Error('Export and verify this commit before uploading.');
    const receipt = JSON.parse(readFileSync(proof, 'utf8'));
    ipa = join(exported, receipt.ipa);
    exportGuard(receipt, commit, fingerprint(ipa), fingerprint(archive));
  } else rmSync(proof, { force: true });
  const temporary = mkdtempSync(join(tmpdir(), 'myht-testflight-'));
  try {
    if (command === 'upload') verifyIpa(ipa, temporary);
    const options = join(temporary, 'ExportOptions.plist');
    writeFileSync(options, `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>method</key><string>app-store-connect</string>
<key>destination</key><string>${command === 'upload' ? 'upload' : 'export'}</string>
<key>signingStyle</key><string>automatic</string>
<key>teamID</key><string>${team}</string>
</dict></plist>`, { mode: 0o600 });
    execFileSync('xcodebuild', ['-exportArchive', '-archivePath', archive, '-exportOptionsPlist', options, ...(command === 'export' ? ['-exportPath', exported] : []), '-allowProvisioningUpdates'], { stdio: 'inherit' });
    if (command === 'export') {
      const files = readdirSync(exported).filter(name => name.endsWith('.ipa'));
      if (files.length !== 1) throw new Error('Expected exactly one exported IPA.');
      ipa = join(exported, files[0]);
      verifyIpa(ipa, temporary);
      writeFileSync(proof, JSON.stringify({ commit, ipa: files[0], ipaHash: fingerprint(ipa), archiveHash: fingerprint(archive) }));
    }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) run();
