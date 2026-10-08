import { h } from '../lib/dom.js';
import { icon } from './icons.js';
import { art, setArt } from './art.js';
import { playerStore } from '../player/player.js';
import { isOpen } from './overlays.js';
import { reducedMotion } from '../lib/dom.js';

/**
 * Pílula-notificação ("app minimizado"): aparece quando a música muda ou ao pausar/retomar.
 * Entra, expande, mostra o estado e recolhe até sobrar só a capa — como na referência.
 */
export function createPill() {
  const cover = art(null, { cls: 'pill-art' });
  const app = h('div', { class: 'pill-app' }, 'InSound');
  const title = h('div', { class: 'pill-title' });
  const artist = h('div', { class: 'pill-artist' });
  const state = h('span', { class: 'pill-state', 'aria-hidden': 'true' });
  const el = h('div', { class: 'pill', role: 'status', 'aria-live': 'polite', 'data-phase': 'idle' },
    cover,
    h('div', { class: 'pill-text' }, app, title, artist),
    state,
  );

  const wave = () => h('span', { class: 'pill-wave' }, h('i'), h('i'), h('i'), h('i'), h('i'));
  const glyph = {
    track: () => wave(),
    pause: () => icon('play', 20),
    resume: () => icon('pause', 20),
    stop: () => icon('close', 20),
  };

  let timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => (timers.forEach(clearTimeout), (timers = []));

  function show(type, track) {
    clearTimers();
    setArt(cover, track.cover);
    title.textContent = track.title;
    artist.textContent = track.artist;
    state.replaceChildren(glyph[type]());
    const quick = reducedMotion();
    el.dataset.phase = 'idle';
    void el.offsetWidth;
    el.dataset.phase = 'enter'; // aparece só como capa e desliza para dentro
    later(() => (el.dataset.phase = 'open'), quick ? 0 : 260); // expande
    later(() => (el.dataset.phase = 'collapse'), quick ? 2200 : 3300); // recolhe até a capa
    later(() => (el.dataset.phase = 'exit'), quick ? 2300 : 3900); // sai
    later(() => (el.dataset.phase = 'idle'), quick ? 2500 : 4400);
  }

  let lastAt = 0;
  playerStore.subscribe((s) => {
    if (!s.event || s.event.at === lastAt) return;
    lastAt = s.event.at;
    if (!s.track || isOpen('player')) return; // com o player aberto a pílula é redundante
    show(s.event.type, s.track);
  });

  el.addEventListener('click', () => {
    clearTimers();
    el.dataset.phase = 'exit';
    later(() => (el.dataset.phase = 'idle'), 400);
  });

  return el;
}
