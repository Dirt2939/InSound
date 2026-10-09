import { BARS } from '../src/components/logo.js';
import { N, STRIDE, SEQ, BOXES, layoutInto, piecesLayout, tweenPieces, radialGeom, tween, clamp, smooth, lerp } from './layouts.js';

/**
 * Palco fixo (sticky) com um canvas: as mesmas 64 barras viram a logo, uma waveform,
 * três equalizadores, um "vinil" radial, silêncio e, por fim, a logo de novo — guiadas pelo scroll.
 */
export function createStage({ root, canvas, chapters, reduced, getAudio }) {
  const ctx = canvas.getContext('2d');
  const logoPaths = BARS.map((d) => new Path2D(d));
  const A = new Float32Array(N * STRIDE);
  const B = new Float32Array(N * STRIDE);
  const OUT = new Float32Array(N * STRIDE);
  const PA = new Float32Array(5 * STRIDE);
  const PB = new Float32Array(5 * STRIDE);
  const PO = new Float32Array(5 * STRIDE);
  const live = new Float32Array(N);
  const levels = new Float32Array(N);
  const MUL = new Float32Array(N);
  const fx = { live, prog: 0, spin: 0 };

  let W = 0, H = 0, dpr = 1;
  let u = 0, target = 0;
  let energy = 0.25; // 0.25 ocioso → 1 tocando
  let pointer = { x: -999, y: -999, seen: 0 };
  const kicks = [];
  let raf = 0, last = 0, visible = true;

  const FG = '#f4f4f4';

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.floor(r.width);
    H = Math.floor(r.height);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
  }
  new ResizeObserver(() => {
    resize();
    if (reduced && W) frame(performance.now());
  }).observe(canvas);

  const readTarget = () => {
    if (reduced) return 0;
    const r = root.getBoundingClientRect();
    const total = r.height - innerHeight;
    return total > 0 ? clamp(-r.top / total, 0, 1) * (SEQ.length - 1) : 0;
  };

  canvas.parentElement.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    pointer.seen = performance.now();
  });
  canvas.parentElement.addEventListener('pointerleave', () => (pointer.x = pointer.y = -999));
  canvas.parentElement.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button')) return;
    const r = canvas.getBoundingClientRect();
    kicks.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() });
    if (kicks.length > 6) kicks.shift();
  });

  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible && !raf && !reduced) raf = requestAnimationFrame(frame);
  });

  function updateLive(t, audio, dt) {
    const playing = audio?.on;
    energy += ((playing ? 1 : 0.25) - energy) * Math.min(1, dt * 0.004);
    const have = playing && audio.levels(levels);
    for (let i = 0; i < N; i++) {
      const sim = Math.sin(t * 0.0016 * (0.6 + (i % 7) * 0.13) + i * 0.9) * (0.25 + 0.6 * energy);
      live[i] = have ? lerp(sim, levels[i] * 1.7 - 0.35, 0.82) : sim;
    }
  }

  function chapterStyle() {
    if (reduced) return;
    chapters.forEach((el, k) => {
      const d = u - k;
      const a = Math.abs(d);
      const o = 1 - smooth(0.2, 0.5, a);
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translate3d(0, ${(-d * 46).toFixed(1)}px, 0)`;
      el.style.filter = o < 0.98 ? `blur(${((1 - o) * 12).toFixed(1)}px)` : 'none';
      el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
      el.style.pointerEvents = o > 0.6 ? 'auto' : 'none';
    });
  }

  function drawBar(o, mulH, alpha) {
    const w = OUT[o + 2];
    const h = OUT[o + 3] * mulH;
    ctx.globalAlpha = clamp(OUT[o + 5] * alpha, 0, 1);
    ctx.save();
    ctx.translate(OUT[o], OUT[o + 1]);
    if (OUT[o + 4]) ctx.rotate(OUT[o + 4]);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w / 2, h / 2));
    else ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fill();
    ctx.restore();
  }

  function drawDisc(t, alpha) {
    if (alpha < 0.01) return;
    const { cx, cy, R } = radialGeom(W, H);
    const r = R * 0.86;
    ctx.save();
    ctx.globalAlpha = alpha;
    let g;
    if (ctx.createConicGradient) {
      g = ctx.createConicGradient(t * 0.0004, cx, cy);
      ['#ff5d73', '#ffb347', '#ffe66d', '#4ade80', '#38bdf8', '#a78bfa', '#ff5d73'].forEach((c, i, arr) => g.addColorStop(i / (arr.length - 1), c));
    } else {
      g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, '#ffe66d'); g.addColorStop(1, '#a78bfa');
    }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    // brilho + furo central (vinil)
    const sh = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 0, cx, cy, r);
    sh.addColorStop(0, 'rgba(255,255,255,.42)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /** As 5 peças orgânicas, cada uma esticada para o seu retângulo da etapa atual. */
  function drawPieces(t, beat, shadow) {
    ctx.save();
    if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 16; }
    logoPaths.forEach((p, k) => {
      const b = BOXES[k], o = k * STRIDE;
      const lvl = live[Math.floor((k + 0.5) * (N / 5))] || 0;
      const breath = 1 + 0.03 * Math.sin(t * 0.0017 + k * 1.3) + (energy - 0.25) * (0.26 * lvl + 0.1 * beat);
      ctx.save();
      ctx.globalAlpha = clamp(PO[o + 5], 0, 1);
      ctx.translate(PO[o], PO[o + 1]);
      ctx.scale(PO[o + 2] / b.w, (PO[o + 3] / b.h) * breath);
      ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
      ctx.fill(p);
      ctx.restore();
    });
    ctx.restore();
  }

  function frame(t) {
    raf = 0;
    if (!visible) return;
    const dt = Math.min(64, t - (last || t));
    last = t;
    if (!W) resize();

    target = readTarget();
    // inércia do scroll: segue o alvo suavemente e com velocidade máxima, para a roda do mouse
    // (que anda em saltos grandes) não "atropelar" as animações
    const ease = (target - u) * Math.min(1, dt * 0.0045);
    const maxStep = dt * 0.0012; // ≈ 1,2 etapas do palco por segundo
    u += clamp(ease, -maxStep, maxStep);
    if (Math.abs(target - u) < 0.0004) u = target;

    const audio = getAudio();
    updateLive(t, audio, dt);
    const beat = audio?.beat?.() || 0;

    const seg = Math.min(SEQ.length - 2, Math.floor(u));
    const frac = u - seg;
    const m = smooth(0.2, 0.8, frac);
    fx.prog = clamp((u - 0.9) / 1.0, 0, 1);
    fx.spin = t * 0.00012 * (0.6 + energy);

    const nameA = SEQ[seg], nameB = SEQ[seg + 1];
    layoutInto(nameA, W, H, A, fx);
    layoutInto(nameB, W, H, B, fx);
    tween(A, B, m, OUT);

    // ── ponteiro, cliques e batida deformam as alturas ──
    const now = performance.now();
    const ptr = now - pointer.seen < 2500;
    const mulH = MUL;
    for (let i = 0; i < N; i++) {
      const o = i * STRIDE;
      let mul = 1 + beat * 0.14 * energy;
      if (ptr) {
        const dx = OUT[o] - pointer.x, dy = OUT[o + 1] - pointer.y;
        mul += 0.6 * Math.exp(-(dx * dx + dy * dy) / (2 * 110 * 110));
      }
      for (const k of kicks) {
        const age = (now - k.t) / 1000;
        if (age > 2.4) continue;
        const d = Math.hypot(OUT[o] - k.x, OUT[o + 1] - k.y);
        mul += 1.5 * Math.exp(-d / 170) * Math.exp(-age * 2.6) * (0.75 + 0.25 * Math.sin(age * 20 - d * 0.035));
      }
      mulH[i] = mul;
    }
    while (kicks.length && now - kicks[0].t > 2400) kicks.shift();

    // ── desenho ──
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = FG;

    piecesLayout(nameA, W, H, PA);
    piecesLayout(nameB, W, H, PB);
    tweenPieces(PA, PB, m, PO);

    const discAlpha = nameA === 'radial' ? 1 - smooth(0, 0.6, m) : nameB === 'radial' ? smooth(0.4, 1, m) : 0;
    drawDisc(t, discAlpha);

    for (let i = 0; i < N; i++) drawBar(i * STRIDE, mulH[i], 1);
    ctx.globalAlpha = 1;
    drawPieces(t, beat, discAlpha > 0.3);

    chapterStyle();
    root.style.setProperty('--u', u.toFixed(3));
    document.documentElement.style.setProperty('--stage-u', (u / (SEQ.length - 1)).toFixed(4));

    if (!reduced) raf = requestAnimationFrame(frame);
  }

  return {
    start() {
      resize();
      if (reduced) frame(performance.now());
      else raf = requestAnimationFrame(frame);
    },
    kick(x = W / 2, y = H / 2) { kicks.push({ x, y, t: performance.now() }); },
    get u() { return u; },
  };
}
