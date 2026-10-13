import { expect, it } from 'vitest';
import { androidReleaseGuard, checkBundleManifest, compareSigningCertificates } from '../../scripts/android-bundle-check.mjs';

const xml = '<manifest package="com.fahadakbar.myht" android:versionCode="372"><application android:debuggable="false" android:allowBackup="false" /></manifest>';
it('checks the actual bundle manifest fields, not source configuration', () => {
  expect(() => checkBundleManifest(xml, 372)).not.toThrow();
  expect(() => checkBundleManifest(xml, 373)).toThrow('version');
  expect(() => checkBundleManifest(xml.replace('myht', 'other'), 372)).toThrow('package');
  expect(() => checkBundleManifest(xml.replace('debuggable="false"', 'debuggable="true"'), 372)).toThrow('debuggable');
  expect(() => checkBundleManifest(xml.replace('allowBackup="false"', 'allowBackup="true"'), 372)).toThrow('backups');
  expect(() => checkBundleManifest(xml.replace('<application', '<application android:usesCleartextTraffic="true"'), 372)).toThrow('HTTP');
  expect(() => checkBundleManifest(xml.replace('<application', '<application android:networkSecurityConfig="@xml/local"'), 372)).toThrow('transport');
});
it('requires a matching staging receipt and all signing environment values', () => {
  const env = { ANDROID_KEYSTORE: '/private/tmp/synthetic.jks', ANDROID_KEY_ALIAS: 'synthetic', ANDROID_KEYSTORE_PASSWORD: 'synthetic', ANDROID_KEY_PASSWORD: 'synthetic' };
  expect(() => androidReleaseGuard({ target: 'local', head: 'now' }, 'now', env)).toThrow();
  expect(() => androidReleaseGuard({ target: 'staging', head: 'old' }, 'now', env)).toThrow();
  for (const key of Object.keys(env)) expect(() => androidReleaseGuard({ target: 'staging', head: 'now', clean: true }, 'now', { ...env, [key]: undefined })).toThrow(key);
  expect(() => androidReleaseGuard({ target: 'staging', head: 'now', clean: true }, 'now', env)).not.toThrow();
  expect(() => androidReleaseGuard({ target: 'staging', head: 'now', clean: false }, 'now', env)).toThrow('Commit');
  expect(() => androidReleaseGuard({ target: 'staging', head: 'now', clean: true }, 'now', env, ' M package.json\n')).toThrow('Commit');
});
it('proves signing with matching SHA-256 certificates and refuses unsigned/mismatched output', () => {
  const certificate = Array(32).fill('A1').join(':');
  const key = 'Certificate fingerprints:\n\tSHA256: ' + certificate;
  expect(compareSigningCertificates('Signer #1:\nSHA256: ' + certificate.toLowerCase(), key)).toBe('A1'.repeat(32));
  expect(() => compareSigningCertificates('Not a signed jar file', key)).toThrow('certificate');
  expect(() => compareSigningCertificates('SHA256: ' + Array(32).fill('B2').join(':'), key)).toThrow('differs');
  expect(() => compareSigningCertificates('SHA256: A1:B2', key)).toThrow('certificate');
});
