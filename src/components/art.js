import { h } from '../lib/dom.js';

/** Capa/foto com placeholder e fade-in. As imagens são exibidas COM cor (nada de P&B). */
export function art(src, { cls = '', round = false, alt = '' } = {}) {
  const wrap = h('div', { class: `art ${round ? 'art-round' : ''} ${cls}`.trim() });
  setArt(wrap, src, alt);
  return wrap;
}

export function setArt(wrap, src, alt = '') {
  wrap.classList.remove('loaded');
  wrap.querySelector('img')?.remove();
  if (!src) return;
  const img = new Image();
  img.alt = alt;
  img.decoding = 'async';
  img.draggable = false;
  img.addEventListener('load', () => wrap.classList.add('loaded'), { once: true });
  img.src = src;
  wrap.append(img);
  if (img.complete && img.naturalWidth) wrap.classList.add('loaded');
}
