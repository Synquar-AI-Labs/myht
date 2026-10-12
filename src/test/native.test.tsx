import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import { Filesystem } from '@capacitor/filesystem';
import { StatusBar } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';
import { isNativeApp, inviteOrigin } from '@/native/platform';
import { nativeAuthStorage } from '@/native/session';
import { shareInvite } from '@/native/share';
import { savePdf, saveAudio, cleanupExports, EXPORT_MAX_AGE_MS } from '@/native/files';
import { initializeNativeChrome } from '@/native/chrome';
import { handleNativeBack, installNativeBack, useNativeBack } from '@/native/back';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn(() => false), getPlatform: vi.fn(() => 'ios') } }));
vi.mock('@capacitor/preferences', () => ({ Preferences: { get: vi.fn(async () => ({ value: 'session' })), set: vi.fn(), remove: vi.fn() } }));
vi.mock('@capacitor/share', () => ({ Share: { share: vi.fn() } }));
vi.mock('@capacitor/filesystem', () => ({ Directory: { Cache: 'CACHE' }, Filesystem: { writeFile: vi.fn(async () => ({ uri: 'file:///cache/report.pdf' })), mkdir: vi.fn(async () => {}), readdir: vi.fn(async () => ({ files: [] })), deleteFile: vi.fn() } }));
vi.mock('@capacitor/status-bar', () => ({ Style: { Light: 'LIGHT' }, StatusBar: { setStyle: vi.fn(), setBackgroundColor: vi.fn() } }));
vi.mock('@capacitor/keyboard', () => ({ Keyboard: { addListener: vi.fn(async () => ({ remove: vi.fn() })) } }));
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: vi.fn() } }));
vi.mock('@capacitor/app', () => ({ App: { minimizeApp: vi.fn(), addListener: vi.fn(async () => ({ remove: vi.fn() })) } }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(Filesystem.readdir).mockResolvedValue({ files: [] });
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
  vi.stubEnv('VITE_NATIVE_APP', 'true'); vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); document.documentElement.classList.remove('native-app'); });
const native = () => vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

describe('native capabilities keep browser paths', () => {
  it('requires both the native build and native runtime', () => {
    expect(isNativeApp()).toBe(false); native(); expect(isNativeApp()).toBe(true);
    vi.stubEnv('VITE_NATIVE_APP', 'false'); expect(isNativeApp()).toBe(false);
  });
  it('shares the web address, not the shell origin', () => {
    expect(inviteOrigin()).toBe(window.location.origin);
    native(); vi.stubEnv('VITE_APP_WEBSITE_URL', 'https://myht-staging.pages.dev');
    expect(inviteOrigin()).toBe('https://myht-staging.pages.dev');
  });
  it('uses browser localStorage and native Preferences', async () => {
    await nativeAuthStorage.setItem('key', 'browser'); expect(await nativeAuthStorage.getItem('key')).toBe('browser');
    await nativeAuthStorage.removeItem('key'); expect(localStorage.getItem('key')).toBeNull(); expect(Preferences.set).not.toHaveBeenCalled();
    native(); await nativeAuthStorage.setItem('key', 'native'); expect(Preferences.set).toHaveBeenCalledWith({ key: 'key', value: 'native' });
    expect(await nativeAuthStorage.getItem('key')).toBe('session'); await nativeAuthStorage.removeItem('key'); expect(Preferences.remove).toHaveBeenCalledWith({ key: 'key' });
  });
  it('uses existing browser sharing with a fallback, and native Share', async () => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); expect(await shareInvite('hello')).toBe(false);
    const share = vi.fn(); Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    expect(await shareInvite('hello')).toBe(true); expect(share).toHaveBeenCalledWith({ title: 'Join our family', text: 'hello' });
    native(); await shareInvite('hello'); expect(Share.share).toHaveBeenCalledWith({ title: 'Join our family', text: 'hello' });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  });
  it('keeps jsPDF save in browsers; shares cache files in native', async () => {
    const doc = { save: vi.fn(), output: vi.fn(() => new Blob(['pdf'])) };
    await savePdf(doc as unknown as jsPDF, 'report.pdf'); expect(doc.save).toHaveBeenCalledWith('report.pdf'); expect(Filesystem.writeFile).not.toHaveBeenCalled();
    native(); await savePdf(doc as unknown as jsPDF, 'report.pdf');
    expect(Filesystem.writeFile).toHaveBeenCalledWith(expect.objectContaining({ directory: 'CACHE', data: 'cGRm', recursive: true }));
    expect(Share.share).toHaveBeenCalledWith({ title: 'report.pdf', files: ['file:///cache/report.pdf'], dialogTitle: 'Save or share' });
    await saveAudio(new Blob(['audio']), 'audio.m4a'); expect(Filesystem.writeFile).toHaveBeenLastCalledWith(expect.objectContaining({ data: 'YXVkaW8=' }));
  });
  it('keeps the browser audio download and revokes its object URL', async () => {
    vi.useFakeTimers();
    const create = vi.fn(() => 'blob:audio'); const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('conversation.m4a'); expect(this.href).toBe('blob:audio');
    });
    await saveAudio(new Blob(['audio']), 'conversation.m4a'); expect(click).toHaveBeenCalledOnce(); expect(Share.share).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000); expect(revoke).toHaveBeenCalledWith('blob:audio'); click.mockRestore(); vi.useRealTimers();
  });
  it('only configures chrome and keyboard on native', async () => {
    await initializeNativeChrome(); expect(StatusBar.setStyle).not.toHaveBeenCalled();
    native(); const cleanup = await initializeNativeChrome();
    expect(document.documentElement.classList.contains('native-app')).toBe(true);
    expect(StatusBar.setStyle).toHaveBeenCalledWith({ style: 'LIGHT' });
    expect(StatusBar.setBackgroundColor).toHaveBeenCalledWith({ color: '#faf7f2' });
    expect(Keyboard.addListener).toHaveBeenCalledWith('keyboardDidShow', expect.any(Function)); expect(SplashScreen.hide).toHaveBeenCalled(); cleanup();
  });
  it('scrolls the actual focused field when the native keyboard opens', async () => {
    native(); const field = document.createElement('input'); document.body.append(field); field.focus();
    field.scrollIntoView = vi.fn(); const cleanup = await initializeNativeChrome();
    const callback = vi.mocked(Keyboard.addListener).mock.calls.at(-1)![1]; callback();
    expect(field.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' }); cleanup(); field.remove();
  });
  it('closes a dialog before navigating; gives child screens first refusal', async () => {
    native(); const handler = vi.fn(() => true); const hook = renderHook(() => useNativeBack(handler));
    const dialog = document.createElement('div'); dialog.setAttribute('role', 'dialog'); dialog.dataset.state = 'open'; document.body.append(dialog);
    const escape = vi.fn(); document.addEventListener('keydown', escape); await handleNativeBack(); expect(escape).toHaveBeenCalled(); expect(handler).not.toHaveBeenCalled();
    dialog.remove(); document.removeEventListener('keydown', escape); await handleNativeBack(); expect(handler).toHaveBeenCalled(); expect(App.minimizeApp).not.toHaveBeenCalled();
    hook.unmount(); await handleNativeBack(); expect(App.minimizeApp).toHaveBeenCalledOnce();
  });
  it('only installs hardware back on Android', async () => {
    await installNativeBack(); expect(App.addListener).not.toHaveBeenCalled(); native();
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios'); await installNativeBack(); expect(App.addListener).not.toHaveBeenCalled();
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android'); await installNativeBack(); expect(App.addListener).toHaveBeenCalledWith('backButton', expect.any(Function));
  });
  it('lets a nested screen handle back before its parent regardless of effect order', async () => {
    native(); const child = vi.fn(() => true); const parent = vi.fn(() => true);
    const nested = renderHook(() => useNativeBack(child, 1)); const root = renderHook(() => useNativeBack(parent, 0));
    await handleNativeBack(); expect(child).toHaveBeenCalledOnce(); expect(parent).not.toHaveBeenCalled();
    root.unmount(); nested.unmount();
  });
  it('cleans only export files older than one hour before writing another', async () => {
    const now = Date.now();
    const entry = (name: string, mtime: number, type: 'file' | 'directory' = 'file') => ({ name, mtime, type, size: 1, uri: 'file:///cache/' + name });
    await cleanupExports(now); expect(Filesystem.readdir).not.toHaveBeenCalled();
    native(); vi.mocked(Filesystem.readdir).mockResolvedValue({ files: [entry('old.pdf', now - EXPORT_MAX_AGE_MS - 1), entry('recent.m4a', now - 1000), entry('boundary.pdf', now - EXPORT_MAX_AGE_MS), entry('folder', 0, 'directory')] });
    vi.mocked(Filesystem.mkdir).mockRejectedValueOnce(new Error('Already exists'));
    await cleanupExports(now);
    expect(Filesystem.deleteFile).toHaveBeenCalledTimes(1);
    expect(Filesystem.deleteFile).toHaveBeenCalledWith({ path: 'exports/old.pdf', directory: 'CACHE' });
    await saveAudio(new Blob(['audio']), 'new.m4a');
    expect(vi.mocked(Filesystem.deleteFile).mock.invocationCallOrder.at(-1)).toBeLessThan(vi.mocked(Filesystem.writeFile).mock.invocationCallOrder[0]);
  });
  it('cleans exports at native startup', async () => {
    native(); const cleanup = await initializeNativeChrome();
    expect(Filesystem.readdir).toHaveBeenCalledWith({ path: 'exports', directory: 'CACHE' }); cleanup();
  });
  it('lets a busy screen veto back before any dialog is dismissed', async () => {
    native(); const hook = renderHook(() => useNativeBack(() => true, 2, true));
    const dialog = document.createElement('div'); dialog.setAttribute('role', 'dialog'); dialog.dataset.state = 'open'; document.body.append(dialog);
    const escape = vi.fn(); document.addEventListener('keydown', escape);
    await handleNativeBack(); expect(escape).not.toHaveBeenCalled(); expect(App.minimizeApp).not.toHaveBeenCalled();
    document.removeEventListener('keydown', escape); dialog.remove(); hook.unmount();
  });
});
