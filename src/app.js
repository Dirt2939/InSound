import { h, $ } from './lib/dom.js';
import { storage } from './lib/store.js';
import { session, applyTheme } from './services/session.js';
import { setProvider } from './services/music.js';
import { setEngine } from './player/player.js';
import { initMediaSession } from './player/mediaSession.js';
import { demoProvider } from './data/demo.js';
import { spotifyProvider } from './spotify/provider.js';
import { audiusProvider } from './audius/provider.js';
import { createAudioEngine } from './player/audioEngine.js';
import { initHistory } from './services/history.js';
import { createSpotifyEngine } from './spotify/engine.js';
import * as auth from './spotify/auth.js';
import { defineRoutes, onRoute, startRouter, match } from './router.js';
import { createTabbar } from './components/tabbar.js';
import { createMiniplayer } from './components/miniplayer.js';
import { createPill } from './components/pill.js';
import { mountToasts } from './components/toast.js';
import { createPlayerOverlay } from './views/playerView.js';
import { createQueueOverlay } from './views/queueView.js';
import { homeView } from './views/home.js';
import { searchView } from './views/search.js';
import { libraryView } from './views/library.js';
import { collectionView } from './views/collection.js';
import { loginView } from './views/login.js';
import { showSplash } from './views/splash.js';

export async function boot() {
  const root = $('#app');
  applyTheme();

  const skip = sessionStorage.getItem('insound:skip-splash');
  sessionStorage.removeItem('insound:skip-splash');
  const splash = showSplash(root, { duration: skip ? 350 : 1700 });

  let mode = session.get().mode;
  let loginError = storage.get('login-error');
  storage.remove('login-error');

  // retorno do login do Spotify (?code=...)
  const redirect = await auth.handleRedirect();
  if (redirect) {
    if (redirect.ok) mode = 'spotify';
    else (loginError = redirect.error), (mode = null);
  }
  if (mode === 'spotify' && !auth.hasSession()) mode = null;

  if (mode === 'spotify') {
    try {
      setProvider(spotifyProvider);
      await setEngine(createSpotifyEngine());
      const user = await spotifyProvider.getUser();
      session.set({ user });
    } catch (err) {
      console.error(err);
      auth.logoutLocal();
      loginError = 'Não foi possível entrar com o Spotify. Tente novamente.';
      mode = null;
    }
  } else if (mode === 'audius') {
    setProvider(audiusProvider);
    await setEngine(createAudioEngine());
    session.set({ user: await audiusProvider.getUser() });
  } else if (mode === 'demo') {
    setProvider(demoProvider);
    session.set({ user: await demoProvider.getUser() });
  }

  if (mode) storage.set('mode', mode);
  else storage.remove('mode');
  session.set({ mode });

  await splash.done;
  if (!mode) {
    root.append(loginView({ error: loginError }));
  } else {
    mountShell(root);
  }
  await splash.hide();
  if (mode === 'spotify') watchSession();
}

/** Detecta revogação de acesso: valida ao voltar para a aba (no máx. a cada 5 min) e a cada 10 min. */
function watchSession() {
  let last = Date.now();
  const check = () => {
    last = Date.now();
    auth.validateSession();
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - last > 5 * 60_000) check();
  });
  setInterval(() => !document.hidden && check(), 10 * 60_000);
  setTimeout(check, 3000); // logo após abrir o app
}

function mountShell(root) {
  const view = h('main', { class: 'view', id: 'view' });
  const overlayHost = h('div', { id: 'overlay-host' });
  const shell = h('div', { class: 'shell' }, view, createMiniplayer(), createTabbar(), overlayHost);
  const stage = h('div', { class: 'stage' }, shell, createPill());
  root.append(stage);

  overlayHost.append(createPlayerOverlay(), createQueueOverlay());
  mountToasts(shell);
  initMediaSession();
  initHistory();

  // ── rotas ──
  defineRoutes([
    ['/home', () => homeView()],
    ['/search', () => searchView()],
    ['/library', () => libraryView()],
    ['/c/:kind/:id', (p) => collectionView(p)],
  ]);

  const scrolls = new Map();
  let current = null; // { path, instance }

  onRoute((path) => {
    if (current?.path === path) return;
    const deep = path.startsWith('/c/');
    const wasDeep = current?.path.startsWith('/c/');
    if (current) {
      scrolls.set(current.path, view.scrollTop);
      current.instance.destroy?.();
    }
    const m = match(path) || match('/home');
    const instance = m.render(m.params);
    current = { path, instance };

    view.replaceChildren(instance.el);
    instance.el.classList.add(deep ? 'enter-push' : wasDeep ? 'enter-pop' : 'enter-fade');
    view.scrollTop = deep ? 0 : scrolls.get(path) || 0;
  });

  if (!location.hash) history.replaceState(null, '', '#/home');
  startRouter();
}
