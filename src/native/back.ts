import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect, useRef } from 'react';
import { isNativeApp } from './platform';

const handlers: { handler: () => boolean; priority: number; beforeDialog: boolean }[] = [];

export function useNativeBack(handler: () => boolean, priority = 1, beforeDialog = false) {
  const current = useRef(handler);
  current.current = handler;
  useEffect(() => {
    if (!isNativeApp()) return;
    const entry = { handler: () => current.current(), priority, beforeDialog };
    handlers.push(entry);
    return () => { const index = handlers.indexOf(entry); if (index >= 0) handlers.splice(index, 1); };
  }, [priority, beforeDialog]);
}

export async function handleNativeBack() {
  if (!isNativeApp()) return;
  const ordered = [...handlers].reverse().sort((a, b) => b.priority - a.priority);
  for (const entry of ordered) if (entry.beforeDialog && entry.handler()) return;
  const dialog = document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
  if (dialog) {
    // Radix and Vaul already implement Escape (including busy/discard guards).
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    return;
  }
  for (const entry of ordered) if (!entry.beforeDialog && entry.handler()) return;
  await App.minimizeApp();
}

export async function installNativeBack() {
  if (!isNativeApp() || Capacitor.getPlatform() !== 'android') return () => {};
  const listener = await App.addListener('backButton', () => { void handleNativeBack(); });
  return () => { void listener.remove(); };
}
