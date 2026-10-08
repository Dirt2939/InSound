import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'web' | 'ios' | 'android'

/**
 * Vibração leve. No navegador usa navigator.vibrate quando existe.
 * Quando adicionarmos o Capacitor nativo: trocar por @capacitor/haptics aqui (único ponto).
 */
export function haptic(kind = 'light') {
  try {
    if (navigator.vibrate) navigator.vibrate(kind === 'light' ? 8 : kind === 'medium' ? 14 : 22);
  } catch {}
}

export async function share({ title, text, url }) {
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return true;
    }
    await navigator.clipboard.writeText(url || text || title);
    return 'copied';
  } catch {
    return false;
  }
}
