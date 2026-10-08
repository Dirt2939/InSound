import { h, $ } from '../lib/dom.js';
import { icon } from './icons.js';
import { art } from './art.js';
import { registerOverlay, openOverlay, closeOverlay } from './overlays.js';

let n = 0;

/**
 * Bottom sheet. `items`: [{ icon, label, hint, onClick, active }]. `content`: nó extra.
 * Retorna { close }.
 */
export function openSheet({ title, subtitle, cover, items = [], content = null }) {
  const name = `sheet:${++n}`;
  const close = () => closeOverlay(name);

  const header =
    title &&
    h('div', { class: 'sheet-head' },
      cover && art(cover, { cls: 'sheet-cover' }),
      h('div', { class: 'sheet-titles' }, h('div', { class: 'sheet-title' }, title), subtitle && h('div', { class: 'sheet-sub' }, subtitle)),
    );

  const list =
    items.length > 0 &&
    h('div', { class: 'sheet-list' },
      items.map((it, i) =>
        h('button', {
          class: `sheet-item ${it.active ? 'is-active' : ''}`,
          style: { '--i': i },
          onclick: async () => {
            await close();
            it.onClick?.();
          },
        },
        icon(it.icon, 22),
        h('span', { class: 'sheet-label' }, it.label),
        it.hint && h('span', { class: 'sheet-hint' }, it.hint),
        ),
      ),
    );

  const panel = h('div', { class: 'sheet-panel', role: 'dialog', 'aria-label': title || 'Opções' },
    h('div', { class: 'sheet-grab' }),
    header,
    list,
    content,
  );
  const root = h('div', { class: 'ov ov-sheet' }, h('div', { class: 'sheet-scrim', onclick: close }), panel);

  $('#overlay-host').append(root);
  registerOverlay(name, root, { dynamic: true });
  // força o estado fechado ser pintado antes de abrir (animação de entrada)
  requestAnimationFrame(() => requestAnimationFrame(() => openOverlay(name)));
  return { close };
}
