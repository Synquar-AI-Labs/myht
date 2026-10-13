import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const stagingHost = 'lefqfxkvujqnukgzaviz.supabase.co';
export const liveRef = 'fvasmrdtzqhswhowlydx';
export function nativeTarget(target, platform, env) {
  if (!['local', 'staging'].includes(target) || !['ios', 'android'].includes(platform)) throw new Error('Choose local or staging, and ios or android.');
  const url = target === 'staging' ? `https://${stagingHost}` : platform === 'android' ? 'http://10.0.2.2:54321' : 'http://127.0.0.1:54321';
  if (env.VITE_SUPABASE_URL !== url || !env.VITE_SUPABASE_PUBLISHABLE_KEY || /PLACEHOLDER|REPLACE/i.test(env.VITE_SUPABASE_PUBLISHABLE_KEY)) throw new Error('Wrong native target or missing public key.');
  return { url, website: target === 'staging' ? 'https://myht-staging.pages.dev' : 'http://127.0.0.1:5187' };
}

export function scanNative(root, target, platform) {
  const texts = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const file = join(dir, name);
      if (statSync(file).isDirectory()) walk(file);
      else texts.push(readFileSync(file, 'utf8'));
    }
  }
  walk(root);
  const text = texts.join('\n');
  if (text.includes(liveRef)) throw new Error('Native artifact contains the live project.');
  if (target === 'staging') {
    if (/127\.0\.0\.1|10\.0\.2\.2|localhost:54321/.test(text)) throw new Error('Staging app contains a local endpoint.');
    const hosts = new Set([...text.matchAll(/https:\/\/([a-z0-9-]+\.supabase\.co)/g)].map(match => match[1]));
    if (hosts.size !== 1 || !hosts.has(stagingHost)) throw new Error('Native staging must contain only the staging host.');
  } else {
    const host = platform === 'ios' ? '127.0.0.1:54321' : '10.0.2.2:54321';
    if (!text.includes(host) || /[a-z0-9-]+\.supabase\.co/.test(text)) throw new Error('Local app must use only the local stack.');
  }
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(text)) throw new Error('Native fonts must be bundled.');
}

export function assertStagingSecurity(plist, manifest, capacitor) {
  if (capacitor.loggingBehavior !== 'none') throw new Error('Staging must disable plugin logging.');
  if (/NSAllowsArbitraryLoads|NSAllowsLocalNetworking|NSExceptionDomains|127\.0\.0\.1|10\.0\.2\.2/.test(plist)) throw new Error('Staging iOS has a local transport allowance.');
  if (/usesCleartextTraffic="true"|networkSecurityConfig|127\.0\.0\.1|10\.0\.2\.2/.test(manifest)) throw new Error('Staging Android has a local transport allowance.');
  if (capacitor.server?.url || capacitor.server?.cleartext || capacitor.server?.allowNavigation?.length) throw new Error('Staging must package its own screens without navigation allowances.');
  if (capacitor.server?.androidScheme === 'http' || capacitor.android?.allowMixedContent) throw new Error('Staging must not allow HTTP or mixed content.');
}
