import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.fahadakbar.myht',
  appName: 'Health Tracker',
  webDir: process.env.NATIVE_WEB_DIR ?? 'dist',
  backgroundColor: '#faf7f2',
  ...(process.env.NATIVE_LOCAL === 'true' ? {} : { loggingBehavior: 'none' as const }),
  ...(process.env.NATIVE_LOCAL === 'true' ? { server: { androidScheme: 'http' } } : {}),
  ios: { contentInset: 'never', preferredContentMode: 'recommended' },
  plugins: {
    SystemBars: { style: 'LIGHT', insetsHandling: 'native', initialViewportFitValueHint: 'cover' },
    Keyboard: { resize: KeyboardResize.Native },
    SplashScreen: { launchAutoHide: false, backgroundColor: '#faf7f2', showSpinner: false },
  },
};
export default config;
