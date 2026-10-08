import { h } from '../lib/dom.js';
import { icon } from './icons.js';
import { art } from './art.js';
import { openTrackMenu } from './trackMenu.js';
import { haptic } from '../platform.js';

/** Linha de música. `subtitle` sobrescreve o padrão (artista). */
export function trackRow(track, { index = 0, onPlay, subtitle, cover = true, number = null, menu = true } = {}) {
  const row = h('div', {
    class: 'row',
    role: 'button',
    tabindex: '0',
    dataset: { id: track.id },
    style: { '--i': Math.min(index, 14) },
    onclick: () => {
      haptic();
      onPlay?.();
    },
    onkeydown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPlay?.()),
  },
  number != null && h('span', { class: 'row-num' }, number),
  cover && art(track.cover, { cls: 'row-art' }),
  h('div', { class: 'row-text' },
    h('div', { class: 'row-title' }, track.title),
    h('div', { class: 'row-sub' }, subtitle ?? track.artist),
  ),
  h('span', { class: 'row-eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
  menu && h('button', {
    class: 'icon-btn row-more',
    'aria-label': 'Mais opções',
    onclick: (e) => {
      e.stopPropagation();
      openTrackMenu(track);
    },
  }, icon('more', 22)),
  );
  return row;
}

/** Linha de coleção (playlist/álbum/artista) — para busca e biblioteca. */
export function collectionRow(item, { index = 0, onOpen, subtitle } = {}) {
  return h('div', {
    class: 'row',
    role: 'button',
    tabindex: '0',
    style: { '--i': Math.min(index, 14) },
    onclick: () => onOpen(item),
    onkeydown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(item)),
  },
  art(item.cover, { cls: 'row-art', round: item.kind === 'artist' }),
  h('div', { class: 'row-text' },
    h('div', { class: 'row-title' }, item.title),
    h('div', { class: 'row-sub' }, subtitle ?? item.subtitle),
  ),
  icon('chev-right', 18, 'row-chev'),
  );
}

/** Marca a linha da faixa atual (equalizador animado) dentro de `root`. */
export function markPlaying(root, trackId, playing) {
  root.querySelectorAll('.row.is-current').forEach((r) => r.classList.remove('is-current', 'is-playing'));
  if (!trackId) return;
  root.querySelectorAll(`.row[data-id="${CSS.escape(trackId)}"]`).forEach((r) => {
    r.classList.add('is-current');
    r.classList.toggle('is-playing', !!playing);
  });
}
