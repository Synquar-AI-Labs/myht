import { Share } from '@capacitor/share';
import { isNativeApp } from './platform';

export async function shareInvite(text: string): Promise<boolean> {
  if (isNativeApp()) {
    await Share.share({ title: 'Join our family', text });
    return true;
  }
  if (!navigator.share) return false;
  await navigator.share({ title: 'Join our family', text });
  return true;
}
