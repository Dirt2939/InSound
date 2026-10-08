import { h } from '../lib/dom.js';
import { playerStore } from '../player/player.js';
import { markPlaying } from './trackRow.js';

export function sectionHead(title, action) {
  return h('div', { class: 'section-head' },
    h('h2', { class: 'section-title' }, title),
    action && h('button', { class: 'link-btn', onclick: action.onClick }, action.label),
  );
}

export function skeletonRows(n = 5) {
  return h('div', { class: 'skel-list', 'aria-hidden': 'true' },
    Array.from({ length: n }, (_, i) =>
      h('div', { class: 'row skel-row', style: { '--i': i } },
        h('div', { class: 'skel skel-art' }),
        h('div', { class: 'row-text' }, h('div', { class: 'skel skel-line' }), h('div', { class: 'skel skel-line short' })),
      ),
    ),
  );
}

export function skeletonCards(n = 4) {
  return h('div', { class: 'cards', 'aria-hidden': 'true' },
    Array.from({ length: n }, (_, i) =>
      h('div', { class: 'card', style: { '--i': i } },
        h('div', { class: 'skel skel-card' }),
        h('div', { class: 'skel skel-line' }),
        h('div', { class: 'skel skel-line short' }),
      ),
    ),
  );
}

export function emptyState({ title, text, action }) {
  return h('div', { class: 'empty' },
    h('div', { class: 'empty-title' }, title),
    text && h('div', { class: 'empty-text' }, text),
    action && h('button', { class: 'btn btn-ghost', onclick: action.onClick }, action.label),
  );
}

/** Mantém a linha da música atual marcada (equalizador) dentro de `root`. */
export function bindNowPlaying(root) {
  const run = (s) => markPlaying(root, s.track?.id, s.playing);
  run(playerStore.get());
  return playerStore.subscribe(run);
}

export function errorState(retry) {
  return emptyState({
    title: 'Não foi possível carregar',
    text: 'Verifique sua conexão e tente de novo.',
    action: { label: 'Tentar de novo', onClick: retry },
  });
}
