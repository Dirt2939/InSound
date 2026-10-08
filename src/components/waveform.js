import { h } from '../lib/dom.js';
import { rng, clamp, fmtTime } from '../lib/format.js';
import { player, playerStore, onFrame } from '../player/player.js';

/**
 * Barra de progresso em forma de waveform (barras orgânicas, eco da logo).
 * As barras são geradas a partir do id da faixa (estáveis) e "respiram" perto do playhead.
 */
export function createWaveform({ onScrub } = {}) {
  const canvas = h('canvas', { class: 'wave-canvas', role: 'slider', 'aria-label': 'Progresso da música', tabindex: '0' });
  const tip = h('div', { class: 'wave-tip' }, '0:00');
  const el = h('div', { class: 'wave' }, canvas, tip);
  const ctx = canvas.getContext('2d');

  const BAR = 3.5, GAP = 3;
  let w = 0, hgt = 0, dpr = 1, n = 0;
  let heights = [];
  let seed = '';
  let colors = { on: '#fff', off: 'rgba(255,255,255,.22)' };
  let dragging = false;
  let dragPos = 0;
  let dirty = true;
  let lastPlaying = false;

  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    const t = cs.getPropertyValue('--text').trim() || '#fff';
    colors = { on: t, off: cs.getPropertyValue('--line-strong').trim() || 'rgba(255,255,255,.2)' };
    dirty = true;
  };
  window.addEventListener('insound:theme', () => requestAnimationFrame(readColors));

  function genHeights() {
    const r = rng(seed || 'x');
    const p1 = r() * 6, p2 = r() * 6, p3 = r() * 6;
    heights = Array.from({ length: n }, (_, i) => {
      const x = i / n;
      let v = 0.5 + 0.22 * Math.sin(x * 9 + p1) + 0.16 * Math.sin(x * 23 + p2) + 0.12 * Math.sin(x * 51 + p3);
      v += (r() - 0.5) * 0.28;
      // pequenas "quebras" como respiros do áudio
      return clamp(v, 0.14, 1);
    });
  }

  function resize() {
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = Math.floor(rect.width);
    hgt = Math.floor(rect.height) || 56;
    canvas.width = w * dpr;
    canvas.height = hgt * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = hgt + 'px';
    n = Math.max(12, Math.floor((w + GAP) / (BAR + GAP)));
    genHeights();
    dirty = true;
  }
  new ResizeObserver(resize).observe(el);

  const rrect = (x, y, bw, bh, r) => {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, bw, bh, r);
      ctx.fill();
    } else ctx.fillRect(x, y, bw, bh);
  };

  function draw(t, pos, dur, playing) {
    if (!w) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    const progress = dur ? clamp(pos / dur, 0, 1) : 0;
    const head = progress * n;
    const step = (w - BAR) / Math.max(1, n - 1);
    for (let i = 0; i < n; i++) {
      const d = Math.abs(i + 0.5 - head);
      let s = heights[i];
      if (playing && d < 6) s *= 1 + 0.16 * Math.sin(t / 170 + i * 0.8) * (1 - d / 6);
      if (d < 0.9) s *= 1.12; // barra do playhead
      s = clamp(s, 0.1, 1);
      const bh = Math.max(BAR, s * (hgt - 6));
      const x = i * step;
      ctx.fillStyle = i + 0.5 <= head ? colors.on : colors.off;
      rrect(x, (hgt - bh) / 2, BAR, bh, BAR / 2);
    }
  }

  // ── gestos de seek ──
  const posFromEvent = (e) => {
    const rect = canvas.getBoundingClientRect();
    return clamp((e.clientX - rect.left) / rect.width, 0, 1) * (playerStore.get().duration || 0);
  };
  const showTip = (e) => {
    const rect = el.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 18, rect.width - 18);
    tip.style.transform = `translateX(${x}px) translateX(-50%)`;
    tip.textContent = fmtTime(dragPos);
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (!playerStore.get().track) return;
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    dragPos = posFromEvent(e);
    el.classList.add('is-dragging');
    showTip(e);
    onScrub?.(dragPos);
    dirty = true;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dragPos = posFromEvent(e);
    showTip(e);
    onScrub?.(dragPos);
    dirty = true;
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    player.seek(dragPos);
    onScrub?.(null);
    dirty = true;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('keydown', (e) => {
    const s = playerStore.get();
    if (!s.track) return;
    if (e.key === 'ArrowRight') player.seek(clamp(player.getPosition() + 5000, 0, s.duration));
    if (e.key === 'ArrowLeft') player.seek(clamp(player.getPosition() - 5000, 0, s.duration));
  });

  let off = null;
  return {
    el,
    /** Liga/desliga o loop de animação (só enquanto visível). */
    setActive(active) {
      if (active && !off) {
        readColors();
        resize();
        off = onFrame((t) => {
          const s = playerStore.get();
          const playing = s.playing;
          if (!playing && !dirty && !dragging && lastPlaying === playing) return;
          lastPlaying = playing;
          const pos = dragging ? dragPos : player.getPosition();
          draw(t, pos, s.duration, playing && !dragging);
          dirty = false;
        });
      } else if (!active && off) {
        off();
        off = null;
      }
    },
    setTrack(id) {
      if (id === seed) return;
      seed = id || '';
      genHeights();
      dirty = true;
    },
    refresh() { dirty = true; },
  };
}
