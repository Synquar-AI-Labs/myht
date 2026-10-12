import { readFileSync, writeFileSync } from 'node:fs';

const paths = { ios: 'ios/App/App/Info.plist', android: 'android/app/src/main/AndroidManifest.xml' };
export function stripLocalTransport(platform, text) {
  return platform === 'ios'
    ? text.replace(/\s*<key>NSAppTransportSecurity<\/key>\s*<dict>[\s\S]*?<\/dict>\s*<!-- native-local-only -->/g, '')
    : text.replace(/\s*android:usesCleartextTraffic="(?:true|false)"/g, '');
}
export function cleanTrackedTransport(platform, path = paths[platform]) {
  const clean = stripLocalTransport(platform, readFileSync(path, 'utf8'));
  writeFileSync(path, clean);
  return clean;
}
export async function withLocalTransport(platform, action, path = paths[platform]) {
  const clean = cleanTrackedTransport(platform, path);
  const local = platform === 'ios'
    ? clean.replace(/<\/dict>\s*<\/plist>\s*$/, '<key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict><!-- native-local-only -->\n</dict>\n</plist>')
    : clean.replace('<application', '<application android:usesCleartextTraffic="true"');
  try { writeFileSync(path, local); return await action(); }
  finally { writeFileSync(path, clean); }
}
