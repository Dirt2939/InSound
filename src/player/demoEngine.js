/** Engine de demonstração: simula a reprodução (sem áudio) com um relógio. */
export function createDemoEngine() {
  let track = null;
  let playing = false;
  let anchorPos = 0;
  let anchorAt = 0;
  let timer = 0;
  const cb = { ended: () => {} };

  const pos = () => (playing ? anchorPos + (performance.now() - anchorAt) : anchorPos);

  function arm() {
    clearTimeout(timer);
    if (!playing || !track) return;
    const left = track.duration - pos();
    timer = setTimeout(() => {
      anchorPos = track.duration;
      playing = false;
      cb.ended();
    }, Math.max(0, left));
  }

  return {
    id: 'demo',
    on(name, fn) { cb[name] = fn; },
    async init() {},
    async load(t, { autoplay = true, position = 0 } = {}) {
      track = t;
      anchorPos = position;
      anchorAt = performance.now();
      playing = autoplay;
      arm();
    },
    play() {
      if (playing || !track) return;
      anchorAt = performance.now();
      playing = true;
      arm();
    },
    pause() {
      if (!playing) return;
      anchorPos = pos();
      playing = false;
      arm();
    },
    seek(ms) {
      anchorPos = Math.max(0, Math.min(ms, track ? track.duration : 0));
      anchorAt = performance.now();
      arm();
    },
    setVolume() {},
    getPosition: pos,
    isPlaying: () => playing,
    destroy() { clearTimeout(timer); },
  };
}
