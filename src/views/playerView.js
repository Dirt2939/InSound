import { h } from '../lib/dom.js';
import { icon, setIcon } from '../components/icons.js';
import { art, setArt } from '../components/art.js';
import { createWaveform } from '../components/waveform.js';
import { openTrackMenu } from '../components/trackMenu.js';
import { toast } from '../components/toast.js';
import { player, playerStore, onFrame } from '../player/player.js';
import { closeOverlay, openOverlay, onOverlayChange, registerOverlay } from '../components/overlays.js';
import { isLiked, ensureLikes, toggleLike, likesStore } from '../services/music.js';
import { session } from '../services/session.js';
import { dominantColor } from '../lib/color.js';
import { fmtTime, clamp } from '../lib/format.js';
import { haptic } from '../platform.js';

export function createPlayerOverlay() {
  const cover = art(null, { cls: 'pl-art' });
  const coverWrap = h('div', { class: 'pl-cover' }, cover);
  const title = h('div', { class: 'pl-title' });
  const artist = h('div', { class: 'pl-artist' });
  const heartIco = icon('heart', 26);
  const heart = h('button', { class: 'icon-btn pl-heart', 'aria-label': 'Curtir', onclick: onHeart }, heartIco);
  const from = h('div', { class: 'pl-from-name' });
  const tCur = h('span', { class: 'time' }, '0:00');
  const tLeft = h('span', { class: 'time' }, '0:00');
  const wave = createWaveform({ onScrub: (ms) => { scrub = ms; paintTimes(); } });
  let scrub = null;

  const shuffleBtn = h('button', { class: 'ctl ctl-sm', 'aria-label': 'Aleatório', onclick: () => { haptic(); player.setShuffle(!playerStore.get().shuffle); } }, icon('shuffle', 24));
  const prevBtn = h('button', { class: 'ctl', 'aria-label': 'Anterior', onclick: () => { haptic(); player.prev(); } }, icon('prev', 30));
  const playIco = icon('pause', 34);
  const playBtn = h('button', { class: 'ctl ctl-main', 'aria-label': 'Tocar ou pausar', onclick: () => { haptic('medium'); player.toggle(); } }, playIco);
  const nextBtn = h('button', { class: 'ctl', 'aria-label': 'Próxima', onclick: () => { haptic(); player.next(); } }, icon('next', 30));
  const repeatIco = icon('repeat', 24);
  const repeatBtn = h('button', { class: 'ctl ctl-sm', 'aria-label': 'Repetir', onclick: () => { haptic(); player.cycleRepeat(); } }, repeatIco);

  const vol = h('input', { class: 'range', type: 'range', min: '0', max: '100', value: String(Math.round(playerStore.get().volume * 100)), 'aria-label': 'Volume' });
  vol.addEventListener('input', () => {
    vol.style.setProperty('--v', vol.value + '%');
    player.setVolume(Number(vol.value) / 100);
  });
  vol.style.setProperty('--v', vol.value + '%');

  const errorBar = h('div', { class: 'pl-error', hidden: true });

  const glow = h('div', { class: 'ambient', 'aria-hidden': 'true' });

  const el = h('section', { class: 'ov ov-player', 'aria-label': 'Tocando agora' },
    h('div', { class: 'pl-sheet' },
      glow,
      h('header', { class: 'pl-head' },
        h('button', { class: 'icon-btn', 'aria-label': 'Fechar player', onclick: () => closeOverlay('player') }, icon('chev-down', 28)),
        h('div', { class: 'pl-from' }, h('div', { class: 'pl-from-label' }, 'Tocando de'), from),
        h('button', { class: 'icon-btn', 'aria-label': 'Mais opções', onclick: () => playerStore.get().track && openTrackMenu(playerStore.get().track) }, icon('more-v', 24)),
      ),
      coverWrap,
      h('div', { class: 'pl-info' }, h('div', { class: 'pl-titles' }, title, artist), heart),
      errorBar,
      wave.el,
      h('div', { class: 'pl-times' }, tCur, tLeft),
      h('div', { class: 'pl-controls' }, shuffleBtn, prevBtn, playBtn, nextBtn, repeatBtn),
      h('div', { class: 'pl-foot' },
        h('button', { class: 'pl-queue', onclick: () => openOverlay('queue') }, icon('queue', 22), h('span', {}, 'Fila')),
        h('div', { class: 'pl-vol' }, icon('volume-low', 20), vol, icon('volume', 20)),
      ),
    ),
  );
  registerOverlay('player', el);

  /* ── pintura ── */
  let last = {};
  const swapAnim = (node) => { node.classList.remove('swap'); void node.offsetWidth; node.classList.add('swap'); };

  function paintTimes() {
    const s = playerStore.get();
    const pos = scrub ?? player.getPosition();
    tCur.textContent = fmtTime(pos);
    tLeft.textContent = '-' + fmtTime(Math.max(0, s.duration - pos));
  }

  function paintLike() {
    const t = playerStore.get().track;
    const on = t ? isLiked(t.id) : false;
    setIcon(heartIco, on ? 'heart-fill' : 'heart', 26);
    heart.classList.toggle('is-on', on);
    heart.setAttribute('aria-pressed', String(on));
  }

  async function onHeart() {
    const t = playerStore.get().track;
    if (!t) return;
    haptic('medium');
    heart.classList.remove('pop'); void heart.offsetWidth; heart.classList.add('pop');
    try { await toggleLike(t); } catch { toast('Não foi possível atualizar'); }
  }

  async function paintAmbient(src) {
    if (!session.get().ambient || !src) return el.style.setProperty('--glow', '0');
    const rgb = await dominantColor(src);
    if (!rgb) return el.style.setProperty('--glow', '0');
    el.style.setProperty('--glow-color', `rgb(${rgb.join(' ')})`);
    el.style.setProperty('--glow', '1');
  }

  function render(s) {
    const t = s.track;
    if (t && t.id !== last.id) {
      setArt(cover, t.coverLarge || t.cover);
      swapAnim(coverWrap);
      title.textContent = t.title;
      artist.textContent = t.artist;
      swapAnim(title.parentElement);
      wave.setTrack(t.id);
      ensureLikes([t]).then(paintLike);
      paintAmbient(t.cover);
      last.id = t.id;
    }
    if (s.source !== last.source) { from.textContent = s.source || 'InSound'; last.source = s.source; }
    if (s.playing !== last.playing) {
      setIcon(playIco, s.playing ? 'pause' : 'play', 34);
      el.classList.toggle('is-paused', !s.playing);
      last.playing = s.playing;
    }
    if (s.shuffle !== last.shuffle) { shuffleBtn.classList.toggle('is-on', s.shuffle); shuffleBtn.setAttribute('aria-pressed', String(s.shuffle)); last.shuffle = s.shuffle; }
    if (s.repeat !== last.repeat) {
      setIcon(repeatIco, s.repeat === 'one' ? 'repeat-one' : 'repeat', 24);
      repeatBtn.classList.toggle('is-on', s.repeat !== 'off');
      last.repeat = s.repeat;
    }
    if (s.error !== last.error) {
      errorBar.hidden = !s.error;
      errorBar.textContent = s.error || '';
      last.error = s.error;
    }
    paintLike();
    paintTimes();
  }
  playerStore.subscribe(render);
  likesStore.subscribe(paintLike);
  session.subscribe(() => paintAmbient(playerStore.get().track?.cover));
  render(playerStore.get());

  // tempo e waveform só enquanto o player está visível
  let offTime = null;
  onOverlayChange((stack) => {
    const open = stack.includes('player');
    wave.setActive(open);
    if (open && !offTime) {
      let lastSec = -1;
      offTime = onFrame(() => {
        const sec = Math.floor((scrub ?? player.getPosition()) / 1000);
        if (sec !== lastSec) { lastSec = sec; paintTimes(); }
      });
    } else if (!open && offTime) { offTime(); offTime = null; }
  });

  /* ── arrastar para baixo fecha (com efeito de "gaveta") ── */
  const sheet = el.querySelector('.pl-sheet');
  let sy = 0, dy = 0, dragging = false, startedOnScrub = false;
  sheet.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.wave, .range, button, input')) { startedOnScrub = true; return; }
    startedOnScrub = false;
    dragging = true; sy = e.clientY; dy = 0;
  });
  sheet.addEventListener('pointermove', (e) => {
    if (!dragging || startedOnScrub) return;
    dy = Math.max(0, e.clientY - sy);
    if (dy > 6) {
      sheet.setPointerCapture(e.pointerId);
      el.classList.add('is-dragging');
      sheet.style.transform = `translateY(${dy}px) scale(${1 - Math.min(0.06, dy / 4000)})`;
      el.style.setProperty('--drag', clamp(dy / 500, 0, 1).toFixed(3));
    }
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    if (dy > 140) {
      closeOverlay('player', { vt: false });
      setTimeout(() => { sheet.style.transform = ''; el.style.removeProperty('--drag'); }, 420);
    } else {
      sheet.style.transform = '';
      el.style.removeProperty('--drag');
    }
    dy = 0;
  };
  sheet.addEventListener('pointerup', release);
  sheet.addEventListener('pointercancel', release);

  document.addEventListener('keydown', (e) => {
    if (!el.classList.contains('open')) return;
    if (e.key === 'Escape') closeOverlay('player');
    if (e.code === 'Space' && !/INPUT|BUTTON/.test(document.activeElement?.tagName)) { e.preventDefault(); player.toggle(); }
  });

  return el;
}
