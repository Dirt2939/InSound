import { getAccessToken } from './auth.js';
import { api } from './api.js';
import { storage } from '../lib/store.js';

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

function loadSdk() {
  if (window.Spotify) return Promise.resolve();
  return new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const s = document.createElement('script');
    s.src = SDK_URL;
    s.async = true;
    s.onerror = () => reject(new Error('Não foi possível carregar o player do Spotify.'));
    document.head.append(s);
  });
}

/**
 * Engine do Spotify (Web Playback SDK). Requer Spotify Premium.
 * Toca uma faixa por vez; fila/shuffle/repeat ficam no player.js.
 */
export function createSpotifyEngine() {
  const cb = { ended: () => {}, error: () => {}, state: () => {}, external: () => {} };
  let sdk = null;
  let deviceId = null;
  let readyResolve;
  const ready = new Promise((r) => (readyResolve = r));
  let initPromise = null;

  let track = null;
  let pending = null; // faixa carregada em pausa, ainda não enviada ao Spotify
  let playing = false;
  let duration = 0;
  let anchorPos = 0;
  let anchorAt = 0;
  let suppressUntil = 0;
  let endedUri = null;
  let transferred = false;

  const now = () => performance.now();
  const quiet = (ms = 800) => (suppressUntil = now() + ms);
  const pos = () => {
    const p = playing ? anchorPos + (now() - anchorAt) : anchorPos;
    return Math.max(0, duration ? Math.min(p, duration) : p);
  };

  function onState(state) {
    if (!state) return;
    const cur = state.track_window?.current_track;
    const prevTracks = state.track_window?.previous_tracks || [];
    const wasPos = pos();

    // fim natural da faixa: o SDK volta pausado em 0 e põe a faixa em "anteriores"
    if (track && cur && cur.uri === track.uri && state.paused && state.position === 0 && endedUri !== track.uri) {
      const nearEnd = duration && wasPos >= duration - 3000;
      if (nearEnd || prevTracks[0]?.uri === cur.uri) {
        endedUri = track.uri;
        playing = false;
        anchorPos = duration;
        cb.ended();
        return;
      }
    }
    if (!track || !cur || cur.uri !== track.uri) return; // mudança vinda de outro app: ignoramos

    if (state.duration && state.duration !== duration) {
      duration = state.duration;
      cb.state({ duration });
    }
    anchorPos = state.position;
    anchorAt = now();
    const nowPlaying = !state.paused;
    if (nowPlaying !== playing) {
      playing = nowPlaying;
      if (now() > suppressUntil) cb.external({ playing }); // pausou/retomou fora do app
    }
  }

  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      await loadSdk();
      sdk = new window.Spotify.Player({
        name: 'InSound',
        getOAuthToken: (done) => getAccessToken().then(done, () => done('')),
        volume: storage.get('volume', 0.8),
      });
      sdk.addListener('ready', ({ device_id }) => { deviceId = device_id; readyResolve(device_id); });
      sdk.addListener('not_ready', () => { deviceId = null; });
      sdk.addListener('player_state_changed', onState);
      sdk.addListener('initialization_error', () => cb.error('Este navegador não suporta o player do Spotify (DRM).'));
      sdk.addListener('authentication_error', () => cb.error('Sessão do Spotify inválida. Saia e entre de novo.'));
      sdk.addListener('account_error', () => cb.error('Tocar dentro do InSound exige Spotify Premium.'));
      sdk.addListener('playback_error', ({ message }) => cb.error(message || 'Erro de reprodução.'));
      const ok = await sdk.connect();
      if (!ok) throw new Error('Não foi possível conectar ao player do Spotify.');
    })();
    return initPromise;
  }

  async function waitDevice() {
    await init();
    return Promise.race([
      ready,
      new Promise((_, rej) => setTimeout(() => rej(new Error('O player do Spotify demorou a responder. Tente de novo.')), 10000)),
    ]);
  }

  async function start(t, position = 0) {
    const id = await waitDevice();
    const body = { uris: [t.uri], position_ms: position };
    try {
      await api('/me/player/play', { method: 'PUT', query: { device_id: id }, body });
    } catch (err) {
      if (err.status === 404 && !transferred) {
        // dispositivo recém-criado ainda não "ativo": transfere e tenta de novo
        transferred = true;
        await api('/me/player', { method: 'PUT', body: { device_ids: [id], play: false } });
        await new Promise((r) => setTimeout(r, 400));
        await api('/me/player/play', { method: 'PUT', query: { device_id: id }, body });
      } else if (err.status === 403) {
        throw new Error('Tocar dentro do InSound exige Spotify Premium.');
      } else throw err;
    }
    transferred = true;
  }

  return {
    id: 'spotify',
    on(name, fn) { cb[name] = fn; },
    init,
    /** Precisa ser chamado dentro de um gesto do usuário (política de autoplay). */
    activate() { init().then(() => sdk?.activateElement?.()).catch(() => {}); },

    async load(t, { autoplay = true } = {}) {
      track = t;
      duration = t.duration || 0;
      endedUri = null;
      anchorPos = 0;
      anchorAt = now();
      quiet(1500);
      if (!autoplay) {
        pending = t;
        playing = false;
        return;
      }
      pending = null;
      playing = true;
      try {
        await start(t);
      } catch (err) {
        playing = false;
        throw err;
      }
    },

    play() {
      quiet();
      if (pending) {
        const t = pending;
        pending = null;
        playing = true;
        anchorAt = now();
        start(t, anchorPos).catch((e) => { playing = false; cb.error(e.message); });
        return;
      }
      anchorPos = pos();
      anchorAt = now();
      playing = true;
      sdk?.resume();
    },

    pause() {
      quiet();
      anchorPos = pos();
      playing = false;
      sdk?.pause();
    },

    seek(ms) {
      quiet();
      anchorPos = ms;
      anchorAt = now();
      if (pending) return;
      sdk?.seek(Math.round(ms));
    },

    setVolume(v) { sdk?.setVolume(v); },
    getPosition: pos,
    isPlaying: () => playing,
    destroy() { sdk?.disconnect(); },
  };
}
