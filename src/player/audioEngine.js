/**
 * Engine de áudio comum (<audio>): toca a URL de stream da faixa (`track.streamUrl`).
 * Um único elemento é reaproveitado — mantém a permissão de autoplay entre faixas (importante no iOS)
 * e integra com Media Session / tela de bloqueio como qualquer player de áudio.
 */
export function createAudioEngine() {
  const audio = new Audio();
  audio.preload = 'auto';
  audio.setAttribute('playsinline', '');
  const cb = { ended: () => {}, error: () => {}, state: () => {}, external: () => {} };
  let track = null;
  let intent = false; // o que o app pediu (tocar/pausar) — para distinguir pausas externas

  audio.addEventListener('ended', () => {
    intent = false;
    cb.ended();
  });
  audio.addEventListener('error', () => {
    if (!track) return;
    intent = false;
    cb.error('Não foi possível carregar esta faixa.', { skip: true });
    cb.state({ playing: false });
  });
  audio.addEventListener('durationchange', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) cb.state({ duration: Math.round(audio.duration * 1000) });
  });
  // pausa/retomada vindas de fora (fone desconectado, ligação, tecla de mídia do sistema)
  audio.addEventListener('pause', () => {
    if (intent && !audio.ended && track) {
      intent = false;
      cb.external({ playing: false });
    }
  });
  audio.addEventListener('play', () => {
    if (!intent && track) {
      intent = true;
      cb.external({ playing: true });
    }
  });

  const start = () => {
    const p = audio.play();
    p?.catch((err) => {
      if (err?.name === 'AbortError') return; // trocou de faixa no meio
      intent = false;
      cb.state({ playing: false });
      cb.error(err?.name === 'NotAllowedError' ? 'Toque em play para iniciar a reprodução.' : 'Não foi possível tocar esta faixa.');
    });
  };

  return {
    id: 'audio',
    on(name, fn) { cb[name] = fn; },
    async init() {},

    async load(t, { autoplay = true } = {}) {
      track = t;
      intent = autoplay;
      audio.src = t.streamUrl;
      audio.currentTime = 0;
      if (autoplay) start();
    },
    play() { intent = true; start(); },
    pause() { intent = false; audio.pause(); },
    seek(ms) { if (track) audio.currentTime = Math.max(0, ms / 1000); },
    setVolume(v) { audio.volume = Math.min(1, Math.max(0, v)); },
    getPosition: () => audio.currentTime * 1000,
    isPlaying: () => !audio.paused,
    destroy() { track = null; intent = false; audio.pause(); audio.removeAttribute('src'); audio.load(); },
  };
}
