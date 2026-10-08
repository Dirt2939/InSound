import { h } from '../lib/dom.js';
import { logo } from '../components/logo.js';
import { icon } from '../components/icons.js';
import { startSpotifyLogin, enterDemo, enterAudius } from '../services/account.js';
import { isConfigured } from '../spotify/auth.js';

export function loginView({ error } = {}) {
  return h('div', { class: 'stage' },
    h('main', { class: 'shell login' },
      h('div', { class: 'login-hero' },
        logo({ size: 76, className: 'login-logo' }),
        h('h1', { class: 'login-name' }, 'InSound'),
        h('p', { class: 'login-tag' }, 'Sua música, do seu jeito.'),
      ),
      h('div', { class: 'login-actions' },
        error && h('div', { class: 'login-error', role: 'alert' }, error),
        h('button', { class: 'btn btn-primary btn-lg', onclick: enterAudius }, icon('play', 18), 'Começar grátis'),
        h('button', { class: 'btn btn-ghost btn-lg', onclick: () => startSpotifyLogin() }, 'Entrar com Spotify (Premium)'),
        h('button', { class: 'btn btn-text', onclick: enterDemo }, 'Explorar o modo demo'),
        h('p', { class: 'login-note' },
          isConfigured()
            ? 'Grátis: músicas de artistas independentes (Audius), sem conta. Spotify toca o catálogo completo, mas exige Premium.'
            : 'Grátis: músicas de artistas independentes (Audius), sem conta. Para o Spotify, defina VITE_SPOTIFY_CLIENT_ID no .env.',
        ),
      ),
    ),
  );
}
