import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { isNativeApp } from './platform';
import { cleanupExports } from './files';

export async function initializeNativeChrome() {
  if (!isNativeApp()) return () => {};
  document.documentElement.classList.add('native-app');
  const focusedField = () => {
    const field = document.activeElement;
    if (field instanceof HTMLElement) field.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const results = await Promise.allSettled([
    StatusBar.setStyle({ style: Style.Light }),
    StatusBar.setBackgroundColor({ color: '#faf7f2' }),
    Keyboard.addListener('keyboardDidShow', focusedField),
    SplashScreen.hide(),
    cleanupExports(),
  ]);
  const keyboard = results[2];
  return () => {
    if (keyboard.status === 'fulfilled') void keyboard.value.remove();
    document.documentElement.classList.remove('native-app');
  };
}
