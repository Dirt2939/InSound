import { createStore, storage } from '../lib/store.js';

/** Configurações e sessão. `mode`: null (sem escolha) | 'demo' | 'spotify'. */
export const session = createStore({
  mode: storage.get('mode', null),
  user: null,
  theme: storage.get('theme', 'dark'), // 'dark' | 'light' | 'auto'
  ambient: storage.get('ambient', true),
});

const mq = matchMedia('(prefers-color-scheme: light)');

export function resolveTheme(t = session.get().theme) {
  return t === 'auto' ? (mq.matches ? 'light' : 'dark') : t;
}

export function applyTheme() {
  const t = resolveTheme();
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#f5f5f5' : '#000000');
  window.dispatchEvent(new Event('insound:theme'));
}

export function setTheme(theme) {
  storage.set('theme', theme);
  session.set({ theme });
  applyTheme();
}

export function setAmbient(ambient) {
  storage.set('ambient', ambient);
  session.set({ ambient });
}

mq.addEventListener('change', () => session.get().theme === 'auto' && applyTheme());
