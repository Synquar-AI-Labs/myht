import { Capacitor } from '@capacitor/core';

export function isNativeApp() {
  return import.meta.env.VITE_NATIVE_APP === 'true' && Capacitor.isNativePlatform();
}

export function inviteOrigin() {
  return isNativeApp() ? import.meta.env.VITE_APP_WEBSITE_URL : window.location.origin;
}
