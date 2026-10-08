import { storage } from '../lib/store.js';
import * as auth from '../spotify/auth.js';
import { toast } from '../components/toast.js';

// Troca de modo/conta recarrega o app: provider e engine começam limpos.
function reload(skipSplash = true) {
  if (skipSplash) sessionStorage.setItem('insound:skip-splash', '1');
  location.hash = '#/home';
  location.reload();
}

export async function startSpotifyLogin() {
  if (!auth.isConfigured()) {
    toast('Defina VITE_SPOTIFY_CLIENT_ID no arquivo .env', { duration: 4200 });
    return;
  }
  storage.set('mode', 'spotify');
  try {
    await auth.login();
  } catch (err) {
    toast(err.message);
  }
}

/** Troca a fonte de música ('spotify' | 'audius' | 'demo'). Recarrega para zerar provider e engine. */
export function switchSource(mode) {
  if (mode === 'spotify') {
    if (auth.hasSession()) {
      storage.set('mode', 'spotify');
      reload();
    } else startSpotifyLogin();
    return;
  }
  storage.set('mode', mode);
  reload();
}

export const enterDemo = () => switchSource('demo');
export const enterAudius = () => switchSource('audius');

export function logout() {
  auth.logoutLocal();
  storage.remove('mode');
  reload(false);
}
