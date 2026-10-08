import { h } from '../lib/dom.js';
import { icon } from '../components/icons.js';
import { openSheet } from '../components/sheet.js';
import { session, setTheme, setAmbient } from '../services/session.js';
import { logout, switchSource } from '../services/account.js';

export function openSettings() {
  const s = session.get();

  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Tema' },
    [['dark', 'Escuro', 'moon'], ['light', 'Claro', 'sun'], ['auto', 'Auto', 'sparkle']].map(([id, label, ic]) =>
      h('button', {
        class: `seg-btn ${s.theme === id ? 'is-active' : ''}`,
        role: 'radio',
        'aria-checked': String(s.theme === id),
        onclick: (e) => {
          setTheme(id);
          e.currentTarget.parentElement.querySelectorAll('.seg-btn').forEach((b) => {
            b.classList.toggle('is-active', b === e.currentTarget);
            b.setAttribute('aria-checked', String(b === e.currentTarget));
          });
        },
      }, icon(ic, 18), label),
    ),
  );

  const sw = h('button', {
    class: `switch ${s.ambient ? 'is-on' : ''}`,
    role: 'switch',
    'aria-checked': String(s.ambient),
    'aria-label': 'Brilho ambiente',
    onclick: (e) => {
      const on = !session.get().ambient;
      setAmbient(on);
      e.currentTarget.classList.toggle('is-on', on);
      e.currentTarget.setAttribute('aria-checked', String(on));
    },
  }, h('i'));

  const user = s.user;
  const SOURCES = [['spotify', 'Spotify'], ['audius', 'Audius'], ['demo', 'Demo']];
  const hint = {
    spotify: user?.name ? `Conectado como ${user.name}. Tocar exige Premium.` : 'Exige Spotify Premium para tocar.',
    audius: 'Música livre e completa. Sem conta, sem Premium.',
    demo: 'Dados de exemplo, sem áudio.',
  }[s.mode] || '';

  const sources = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Fonte de música' },
    SOURCES.map(([id, label]) =>
      h('button', {
        class: `seg-btn ${s.mode === id ? 'is-active' : ''}`,
        role: 'radio',
        'aria-checked': String(s.mode === id),
        onclick: () => switchSource(id),
      }, label),
    ),
  );

  const content = h('div', { class: 'settings' },
    h('div', { class: 'set-row' }, h('div', {}, h('div', { class: 'set-label' }, 'Tema'), h('div', { class: 'set-hint' }, 'Aparência do app')), seg),
    h('div', { class: 'set-row' }, h('div', {}, h('div', { class: 'set-label' }, 'Brilho ambiente'), h('div', { class: 'set-hint' }, 'Um leve reflexo da capa no player')), sw),
    h('div', { class: 'set-source' },
      h('div', { class: 'set-label' }, 'Fonte de música'),
      sources,
      h('div', { class: 'set-hint' }, hint),
    ),
    s.mode === 'spotify' && h('div', { class: 'set-account' },
      h('div', {}, h('div', { class: 'set-label' }, 'Conta Spotify'), h('div', { class: 'set-hint' }, 'Desconectar apaga a sessão deste aparelho.')),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => logout() }, 'Sair'),
    ),
    h('div', { class: 'set-foot' }, 'InSound · sua música, do seu jeito.'),
  );
  openSheet({ title: 'Configurações', content });
}
