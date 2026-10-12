import { Preferences } from '@capacitor/preferences';
import { isNativeApp } from './platform';

// Supabase supports async storage. Keep the browser's storage unchanged.
export const nativeAuthStorage = {
  async getItem(key: string) {
    if (!isNativeApp()) return localStorage.getItem(key);
    return (await Preferences.get({ key })).value;
  },
  async setItem(key: string, value: string) {
    if (!isNativeApp()) { localStorage.setItem(key, value); return; }
    await Preferences.set({ key, value });
  },
  async removeItem(key: string) {
    if (!isNativeApp()) { localStorage.removeItem(key); return; }
    await Preferences.remove({ key });
  },
};
