import { assertReleaseBuild } from './native-release-tree.mjs';

export function checkBundleManifest(xml, version) {
  const attribute = name => xml.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
  if (attribute('package') !== 'com.fahadakbar.myht') throw new Error('Wrong bundle package.');
  if (attribute('android:versionCode') !== String(version)) throw new Error('Wrong bundle version code.');
  if (attribute('android:debuggable') === 'true' || (attribute('android:debuggable') && attribute('android:debuggable') !== 'false')) throw new Error('Bundle must not be debuggable.');
  if (attribute('android:allowBackup') !== 'false') throw new Error('Bundle backups must be off.');
  if (attribute('android:usesCleartextTraffic') && attribute('android:usesCleartextTraffic') !== 'false') throw new Error('Bundle must not allow HTTP.');
  if (attribute('android:networkSecurityConfig') || /127\.0\.0\.1|10\.0\.2\.2|localhost:54321/.test(xml)) throw new Error('Bundle contains a local transport allowance.');
}

export function androidReleaseGuard(receipt, head, env, status = '') {
  assertReleaseBuild(receipt, head, status);
  for (const key of ['ANDROID_KEYSTORE', 'ANDROID_KEY_ALIAS', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_PASSWORD']) if (!env[key]) throw new Error(`Set ${key} for the release command.`);
}


export function certificateFingerprint(output) {
  const match = output.match(/SHA-?256:\s*([0-9a-fA-F:]+)/);
  const fingerprint = match?.[1].replaceAll(':', '').toUpperCase();
  if (!fingerprint || !/^[0-9A-F]{64}$/.test(fingerprint)) throw new Error('No valid SHA-256 signing certificate found.');
  return fingerprint;
}

export function compareSigningCertificates(bundleOutput, keyOutput) {
  const fingerprint = certificateFingerprint(bundleOutput);
  if (fingerprint !== certificateFingerprint(keyOutput)) throw new Error('Bundle signing certificate differs from the upload key.');
  return fingerprint;
}
