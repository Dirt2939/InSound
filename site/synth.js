import { N, clamp } from './layouts.js';

/**
 * Sintetizador generativo (Web Audio) para o botão "Dar play" da página.
 * Som 100% gerado aqui — arpejo em lá menor pentatônico + baixo + "kick" — sem música de ninguém.
 * Só inicia após um clique (política de autoplay) e entra com fade, em volume baixo.
 */
const SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25];
const PATTERN = [0, 2, 4, 2, 5, 4, 2, 1, 0, 3, 5, 7, 5, 4, 2, 3];
const BASS = [110, 110, 87.31, 98];
const BPM = 92;

export function createSynth() {
  let ac = null, master = null, analyser = null, timer = 0;
  let nextTime = 0, step = 0, on = false, lastKick = -10;
  const bins = new Uint8Array(256);

  function voice(freq, when, { type = 'triangle', gain = 0.18, dur = 0.7, dest }) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(dest);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  function schedule() {
    const stepLen = 60 / BPM / 2;
    while (nextTime < ac.currentTime + 0.18) {
      const n = PATTERN[step % PATTERN.length];
      voice(SCALE[n], nextTime, { dest: master.fx, gain: 0.16, dur: 0.75 });
      if (step % 4 === 0) voice(SCALE[n] / 2, nextTime, { type: 'sine', dest: master, gain: 0.1, dur: 1.1 });
      if (step % 8 === 0) voice(BASS[(step / 8) % BASS.length], nextTime, { type: 'sine', dest: master, gain: 0.34, dur: 2.2 });
      if (step % 4 === 0) {
        // kick: seno com queda rápida de frequência
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.frequency.setValueAtTime(130, nextTime);
        o.frequency.exponentialRampToValueAtTime(42, nextTime + 0.18);
        g.gain.setValueAtTime(0.5, nextTime);
        g.gain.exponentialRampToValueAtTime(0.0001, nextTime + 0.28);
        o.connect(g).connect(master);
        o.start(nextTime);
        o.stop(nextTime + 0.3);
        const delay = Math.max(0, (nextTime - ac.currentTime) * 1000);
        setTimeout(() => (lastKick = performance.now()), delay);
      }
      nextTime += stepLen;
      step++;
    }
  }

  function build() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = 0;
    analyser = ac.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.78;
    // eco suave para os arpejos
    const fx = ac.createGain();
    const delay = ac.createDelay(1);
    const fb = ac.createGain();
    const lp = ac.createBiquadFilter();
    delay.delayTime.value = 60 / BPM * 0.75;
    fb.gain.value = 0.38;
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    fx.connect(master);
    fx.connect(delay);
    delay.connect(lp).connect(fb).connect(delay);
    lp.connect(master);
    master.fx = fx;
    master.connect(analyser);
    analyser.connect(ac.destination);
  }

  return {
    get on() { return on; },
    async start() {
      if (on) return;
      try {
        if (!ac) build();
        await ac.resume();
      } catch {
        return;
      }
      on = true;
      step = 0;
      nextTime = ac.currentTime + 0.08;
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setValueAtTime(master.gain.value, ac.currentTime);
      master.gain.linearRampToValueAtTime(0.5, ac.currentTime + 1.2);
      timer = setInterval(schedule, 25);
      schedule();
    },
    stop() {
      if (!on) return;
      on = false;
      clearInterval(timer);
      const t = ac.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + 0.5);
      setTimeout(() => !on && ac.suspend().catch(() => {}), 650);
    },
    /** Preenche `out[N]` com 0..1 a partir do espectro real (escala log: graves ocupam mais barras). */
    levels(out) {
      if (!on || !analyser) return false;
      analyser.getByteFrequencyData(bins);
      for (let i = 0; i < N; i++) {
        const a = 1 + Math.floor(Math.pow(i / N, 1.7) * 90);
        const b = Math.max(a + 1, 1 + Math.floor(Math.pow((i + 1) / N, 1.7) * 90));
        let m = 0;
        for (let k = a; k < b; k++) m = Math.max(m, bins[k]);
        out[i] = clamp(m / 255, 0, 1);
      }
      return true;
    },
    /** 0..1: pulso do kick (decai rápido). */
    beat() {
      return on ? Math.exp(-(performance.now() - lastKick) / 160) : 0;
    },
  };
}
