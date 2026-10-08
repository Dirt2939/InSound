import { createStore, storage } from '../lib/store.js';
import { createDemoEngine } from './demoEngine.js';

/**
 * Player: fila, shuffle e repeat vivem aqui (client-side) e são independentes do engine.
 * O engine só sabe tocar UMA faixa por vez (demo: relógio; Spotify: Web Playback SDK).
 */
export const playerStore = createStore({
  queue: [],
  index: -1,
  track: null,
  playing: false,
  duration: 0,
  shuffle: false,
  repeat: 'off', // 'off' | 'all' | 'one'
  volume: storage.get('volume', 0.8),
  source: '',
  event: null, // { type: 'track' | 'pause' | 'resume' | 'stop', at } — alimenta a pílula
  error: null,
});

let engine = createDemoEngine();
let baseQueue = [];
let gen = 0; // invalida loads antigos

const S = () => playerStore.get();
const emit = (type) => playerStore.set({ event: { type, at: Date.now() } });

function bindEngine(e) {
  e.on('ended', onEnded);
  e.on('error', (msg, opts) => {
    playerStore.set({ error: msg, playing: false });
    if (opts?.skip) skipBroken();
  });
  e.on('state', (patch) => playerStore.set(patch)); // engine pode reportar playing/duration reais
  e.on('external', (info) => handleExternal(info));
}
bindEngine(engine);

export async function setEngine(next) {
  engine.destroy?.();
  engine = next;
  bindEngine(engine);
  await engine.init?.();
  // Troca de engine zera a reprodução atual.
  gen++;
  baseQueue = [];
  playerStore.set({ queue: [], index: -1, track: null, playing: false, duration: 0, source: '', error: null });
}

export const getEngine = () => engine;

function shuffled(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function loadIndex(i, { autoplay = true, silent = false } = {}) {
  const s = S();
  const track = s.queue[i];
  if (!track) return;
  const my = ++gen;
  const changed = !s.track || s.track.id !== track.id;
  playerStore.set({ index: i, track, duration: track.duration, playing: autoplay, error: null });
  if (changed && !silent) emit('track');
  try {
    await engine.load(track, { autoplay });
  } catch (err) {
    if (my !== gen) return;
    playerStore.set({ playing: false, error: err?.message || 'Não foi possível tocar esta música.' });
  }
}

let failStreak = 0;
let lastFailAt = 0;
/** Faixa que não carrega (ex.: removida do Audius): tenta a próxima, no máximo 3 vezes seguidas. */
function skipBroken() {
  const now = Date.now();
  failStreak = now - lastFailAt > 15000 ? 1 : failStreak + 1;
  lastFailAt = now;
  const s = S();
  if (failStreak > 3 || s.index >= s.queue.length - 1) return;
  const at = s.index;
  setTimeout(() => S().index === at && !S().playing && loadIndex(at + 1), 1200);
}

function onEnded() {
  const s = S();
  if (s.repeat === 'one') return loadIndex(s.index);
  if (s.index < s.queue.length - 1) return loadIndex(s.index + 1);
  if (s.repeat === 'all' && s.queue.length) return loadIndex(0);
  playerStore.set({ playing: false });
  emit('stop');
}

// Mudanças vindas de fora (ex.: o usuário pausou pelo app do Spotify / outro dispositivo).
function handleExternal({ playing }) {
  if (playing === S().playing) return;
  playerStore.set({ playing });
  emit(playing ? 'resume' : 'pause');
}

export const player = {
  getPosition: () => engine.getPosition(),

  playTracks(tracks, startIndex = 0, source = '') {
    if (!tracks.length) return;
    engine.activate?.();
    baseQueue = tracks.slice();
    let queue = baseQueue;
    let index = startIndex;
    if (S().shuffle) {
      const first = baseQueue[startIndex];
      queue = [first, ...shuffled(baseQueue.filter((_, i) => i !== startIndex))];
      index = 0;
    }
    playerStore.set({ queue, source });
    return loadIndex(index);
  },

  playIndex(i) {
    return loadIndex(i);
  },

  toggle() {
    const s = S();
    if (!s.track) return;
    if (s.playing) return this.pause();
    return this.play();
  },

  play() {
    const s = S();
    if (!s.track) return;
    engine.activate?.();
    // fim da fila parado → recomeça a faixa
    if (!s.playing && engine.getPosition() >= s.duration - 300) engine.seek(0);
    engine.play();
    playerStore.set({ playing: true });
    emit('resume');
  },

  pause() {
    engine.pause();
    playerStore.set({ playing: false });
    emit('pause');
  },

  next() {
    const s = S();
    if (!s.queue.length) return;
    if (s.index < s.queue.length - 1) return loadIndex(s.index + 1, { autoplay: true });
    if (s.repeat === 'all') return loadIndex(0);
    // fim da fila: volta ao início, pausado
    return loadIndex(0, { autoplay: false });
  },

  prev() {
    const s = S();
    if (!s.queue.length) return;
    if (engine.getPosition() > 3000 || s.index === 0) {
      engine.seek(0);
      return;
    }
    return loadIndex(s.index - 1);
  },

  seek(ms) {
    engine.seek(ms);
  },

  setVolume(v) {
    storage.set('volume', v);
    playerStore.set({ volume: v });
    engine.setVolume(v);
  },

  setShuffle(on) {
    const s = S();
    if (on === s.shuffle) return;
    if (on) {
      // mantém o que já passou na ordem; embaralha só o que vem depois da faixa atual
      const played = s.queue.slice(0, s.index);
      const after = s.queue.slice(s.index + 1);
      const queue = [...played, s.track, ...shuffled(after)];
      playerStore.set({ shuffle: true, queue, index: played.length });
    } else {
      const cur = S().track;
      let queue = baseQueue.length ? baseQueue : S().queue;
      const idx = queue.findIndex((t) => t.id === cur?.id);
      if (idx === -1 && cur) queue = [cur, ...queue];
      playerStore.set({ shuffle: false, queue, index: Math.max(0, idx) });
    }
  },

  setRepeat(mode) {
    playerStore.set({ repeat: mode });
  },

  cycleRepeat() {
    const next = { off: 'all', all: 'one', one: 'off' }[S().repeat];
    this.setRepeat(next);
  },

  /** Adiciona logo depois do que já foi enfileirado manualmente (como o "Adicionar à fila" de sempre). */
  enqueue(track) {
    const s = S();
    if (!s.queue.length) return this.playTracks([track], 0, 'Fila');
    const item = { ...track, queued: true };
    let at = s.index + 1;
    while (s.queue[at]?.queued) at++;
    const queue = s.queue.slice();
    queue.splice(at, 0, item);
    playerStore.set({ queue });
    const bi = baseQueue.findIndex((t) => t.id === s.track.id);
    if (bi !== -1) baseQueue.splice(bi + 1, 0, item);
  },

  removeFromQueue(i) {
    const s = S();
    if (i === s.index || i < 0 || i >= s.queue.length) return;
    const queue = s.queue.slice();
    const [gone] = queue.splice(i, 1);
    baseQueue = baseQueue.filter((t) => t !== gone);
    playerStore.set({ queue, index: i < s.index ? s.index - 1 : s.index });
  },
};

/* ───────── loop de frames: components assinam para animar com a posição ───────── */
const frameSubs = new Set();
let raf = 0;
function loop(t) {
  frameSubs.forEach((fn) => fn(t));
  raf = frameSubs.size ? requestAnimationFrame(loop) : 0;
}
export function onFrame(fn) {
  frameSubs.add(fn);
  if (!raf) raf = requestAnimationFrame(loop);
  return () => frameSubs.delete(fn);
}
