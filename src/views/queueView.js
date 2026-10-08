import { h, clear } from '../lib/dom.js';
import { icon } from '../components/icons.js';
import { art } from '../components/art.js';
import { player, playerStore } from '../player/player.js';
import { closeOverlay, registerOverlay, onOverlayChange } from '../components/overlays.js';
import { toast } from '../components/toast.js';

export function createQueueOverlay() {
  const body = h('div', { class: 'q-body' });
  const el = h('section', { class: 'ov ov-queue', 'aria-label': 'Fila de reprodução' },
    h('div', { class: 'q-sheet' },
      h('header', { class: 'q-head' },
        h('h2', { class: 'q-title' }, 'Fila'),
        h('button', { class: 'icon-btn', 'aria-label': 'Fechar fila', onclick: () => closeOverlay('queue') }, icon('close', 24)),
      ),
      body,
    ),
  );
  registerOverlay('queue', el);

  function row(t, i, current) {
    return h('div', { class: `row q-row ${current ? 'is-current is-playing' : ''}`, style: { '--i': Math.min(i, 12) }, role: 'button', tabindex: '0', onclick: () => player.playIndex(i) },
      art(t.cover, { cls: 'row-art' }),
      h('div', { class: 'row-text' }, h('div', { class: 'row-title' }, t.title), h('div', { class: 'row-sub' }, t.artist)),
      current
        ? h('span', { class: 'row-eq always', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))
        : h('button', { class: 'icon-btn', 'aria-label': 'Remover da fila', onclick: (e) => { e.stopPropagation(); player.removeFromQueue(i); toast('Removida da fila'); } }, icon('close', 18)),
    );
  }

  function render() {
    const s = playerStore.get();
    clear(body);
    if (!s.track) {
      body.append(h('div', { class: 'empty' }, h('div', { class: 'empty-title' }, 'Fila vazia'), h('div', { class: 'empty-text' }, 'Escolha uma música para começar.')));
      return;
    }
    body.append(h('div', { class: 'q-section' }, 'Tocando agora'), row(s.track, s.index, true));
    const next = s.queue.slice(s.index + 1);
    if (next.length) {
      body.append(h('div', { class: 'q-section' }, 'A seguir'));
      next.forEach((t, k) => body.append(row(t, s.index + 1 + k, false)));
    } else body.append(h('div', { class: 'q-end' }, 'Fim da fila'));
  }

  let open = false;
  onOverlayChange((stack) => {
    const now = stack.includes('queue');
    if (now && !open) render();
    open = now;
  });
  let sig = '';
  playerStore.subscribe((s) => {
    if (!open) return;
    const next = s.index + ':' + s.queue.length + ':' + (s.track?.id ?? '');
    if (next !== sig) { sig = next; render(); }
  });
  return el;
}
