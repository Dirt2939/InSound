import { h } from '../lib/dom.js';
import { icon, setIcon } from './icons.js';
import { art, setArt } from './art.js';
import { player, playerStore, onFrame } from '../player/player.js';
import { openOverlay } from './overlays.js';
import { haptic } from '../platform.js';
import { clamp } from '../lib/format.js';

export function createMiniplayer() {
  const cover = art(null, { cls: 'mini-art' });
  const title = h('div', { class: 'mini-title' });
  const sub = h('div', { class: 'mini-sub' });
  const playIcon = icon('play', 22);
  const playBtn = h('button', {
    class: 'icon-btn mini-play',
    'aria-label': 'Tocar ou pausar',
    onclick: (e) => {
      e.stopPropagation();
      haptic();
      player.toggle();
    },
  }, playIcon);
  const nextBtn = h('button', {
    class: 'icon-btn mini-next',
    'aria-label': 'Próxima',
    onclick: (e) => {
      e.stopPropagation();
      player.next();
    },
  }, icon('next', 20));
  const bar = h('div', { class: 'mini-progress-bar' });
  const body = h('div', { class: 'mini-body' }, cover, h('div', { class: 'mini-meta' }, title, sub), playBtn, nextBtn);
  const el = h('div', { class: 'mini', role: 'button', tabindex: '0', 'aria-label': 'Abrir player', hidden: true },
    body,
    h('div', { class: 'mini-progress' }, bar),
  );

  const open = () => openOverlay('player', { vt: true });
  el.addEventListener('keydown', (e) => (e.key === 'Enter') && open());

  // toque abre; arrastar horizontal troca de faixa
  let sx = 0, dx = 0, down = false, moved = false;
  el.addEventListener('pointerdown', (e) => {
    down = true; moved = false; sx = e.clientX; dx = 0;
  });
  el.addEventListener('pointermove', (e) => {
    if (!down) return;
    dx = e.clientX - sx;
    if (Math.abs(dx) > 8) {
      moved = true;
      el.setPointerCapture(e.pointerId);
      body.style.transition = 'none';
      body.style.transform = `translateX(${dx * 0.5}px)`;
      body.style.opacity = String(1 - Math.min(0.5, Math.abs(dx) / 300));
    }
  });
  const up = () => {
    if (!down) return;
    down = false;
    body.style.transition = '';
    body.style.transform = '';
    body.style.opacity = '';
    if (moved && Math.abs(dx) > 70) {
      haptic();
      dx < 0 ? player.next() : player.prev();
    } else if (!moved) open();
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);

  let last = { id: null, playing: null };
  function render(s) {
    const t = s.track;
    el.hidden = !t;
    document.documentElement.classList.toggle('has-mini', !!t);
    if (!t) return;
    if (t.id !== last.id) {
      setArt(cover, t.cover);
      title.textContent = t.title;
      sub.textContent = t.artist;
      body.classList.remove('swap');
      void body.offsetWidth;
      body.classList.add('swap');
      last.id = t.id;
    }
    if (s.playing !== last.playing) {
      setIcon(playIcon, s.playing ? 'pause' : 'play', 22);
      el.classList.toggle('is-playing', s.playing);
      last.playing = s.playing;
    }
  }
  playerStore.subscribe(render);
  render(playerStore.get());

  let lastW = -1;
  onFrame(() => {
    const s = playerStore.get();
    if (!s.track || el.hidden) return;
    const p = s.duration ? clamp(player.getPosition() / s.duration, 0, 1) : 0;
    if (Math.abs(p - lastW) > 0.0005) {
      bar.style.transform = `scaleX(${p})`;
      lastW = p;
    }
  });

  return el;
}
