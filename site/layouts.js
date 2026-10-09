/**
 * Layouts do palco: cada layout descreve as mesmas N barras em posições diferentes.
 * Tudo aqui é puro (sem DOM) — o palco só interpola entre dois layouts conforme o scroll.
 * Formato por barra (stride 6): cx, cy, w, h, ang, alpha
 */
export const N = 64;
export const STRIDE = 6;
export const SEQ = ['logo', 'wave', 'clusters', 'radial', 'line', 'logo'];

// caixas delimitadoras das 5 barras da logo (viewBox 512x443)
export const BOXES = [
  { x: 11, y: 121, w: 78, h: 229 },
  { x: 106, y: 61, w: 85, h: 334 },
  { x: 204, y: 9, w: 108, h: 429 },
  { x: 319, y: 75, w: 90, h: 318 },
  { x: 423, y: 120, w: 80, h: 223 },
];
export const LOGO_VB = { w: 512, h: 443 };

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Envelope "orgânico" fixo (mesma ideia da waveform do app). */
export const ENV = (() => {
  const r = mulberry32(2026);
  const p1 = r() * 6, p2 = r() * 6, p3 = r() * 6;
  return Array.from({ length: N }, (_, i) => {
    const x = i / N;
    let v = 0.5 + 0.22 * Math.sin(x * 9 + p1) + 0.16 * Math.sin(x * 23 + p2) + 0.12 * Math.sin(x * 51 + p3);
    v += (r() - 0.5) * 0.28;
    return clamp(v, 0.14, 1);
  });
})();

const put = (out, i, cx, cy, w, h, ang, alpha) => {
  const o = i * STRIDE;
  out[o] = cx; out[o + 1] = cy; out[o + 2] = w; out[o + 3] = h; out[o + 4] = ang; out[o + 5] = alpha;
};

/* ───────── logo: cada barra da logo fatiada em colunas finas ───────── */
export function logoLayout(W, H, out) {
  const s = Math.min((W * 0.7) / LOGO_VB.w, (H * 0.4) / LOGO_VB.h);
  const ox = (W - LOGO_VB.w * s) / 2;
  const oy = (H - LOGO_VB.h * s) / 2 - H * 0.12;
  const total = BOXES.reduce((a, b) => a + b.w, 0);
  const counts = BOXES.map((b) => Math.max(1, Math.round((N * b.w) / total)));
  let diff = N - counts.reduce((a, b) => a + b, 0);
  while (diff !== 0) { counts[2] += Math.sign(diff); diff -= Math.sign(diff); }
  let i = 0;
  BOXES.forEach((b, bi) => {
    const c = counts[bi];
    for (let j = 0; j < c; j++) {
      const w = b.w / c;
      put(out, i++, ox + (b.x + w * j + w / 2) * s, oy + (b.y + b.h / 2) * s, w * s + 0.8, b.h * s, 0, 1);
    }
  });
  return { ox, oy, s };
}

/* ───────── waveform: a barra de progresso do app, em tela cheia ───────── */
export function waveLayout(W, H, out, fx) {
  const m = W * 0.07;
  const step = (W - 2 * m) / (N - 1);
  const bw = clamp(step * 0.58, 2.5, 8);
  for (let i = 0; i < N; i++) {
    const h = H * 0.3 * (0.18 + 0.82 * ENV[i]) * (1 + fx.live[i] * 0.35);
    put(out, i, m + i * step, H * 0.4, bw, Math.max(bw, h), 0, i / (N - 1) <= fx.prog ? 1 : 0.2);
  }
}

/* ───────── três equalizadores: Audius · Spotify · Demo ───────── */
export function clustersLayout(W, H, out, fx) {
  const groups = [
    { from: 0, to: 21, cx: 0.17, kind: 'spiky', amp: 0.55 },
    { from: 21, to: 42, cx: 0.5, kind: 'smooth', amp: 0.35 },
    { from: 42, to: 64, cx: 0.83, kind: 'flat', amp: 0.18 },
  ];
  const bw = clamp(W * 0.0085, 3, 8);
  const base = H * 0.56;
  const hmax = H * 0.3;
  for (const g of groups) {
    const count = g.to - g.from;
    const gw = Math.min(W * 0.26, count * bw * 2.1);
    const step = gw / (count - 1);
    for (let k = 0; k < count; k++) {
      const i = g.from + k;
      const x = k / (count - 1);
      let p;
      if (g.kind === 'spiky') p = 0.25 + 0.75 * Math.abs(Math.sin(k * 1.7 + 0.6)) * (0.6 + 0.4 * ENV[i]);
      else if (g.kind === 'smooth') p = 0.2 + 0.8 * Math.pow(Math.sin(Math.PI * x), 1.4);
      else p = 0.1 + 0.08 * ENV[i];
      const h = Math.max(bw, hmax * p * (1 + fx.live[i] * g.amp * 1.4));
      put(out, i, W * g.cx - gw / 2 + k * step, base - h / 2, bw, h, 0, 1);
    }
  }
}

/* ───────── radial: um "vinil" de barras em volta da capa colorida ───────── */
export function radialGeom(W, H) {
  return { cx: W / 2, cy: H * 0.37, R: Math.min(W * 0.28, H * 0.16) };
}
export function radialLayout(W, H, out, fx) {
  const { cx, cy, R } = radialGeom(W, H);
  const bw = clamp((2 * Math.PI * R) / N * 0.5, 3, 12);
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2 - Math.PI / 2 + fx.spin;
    const h = Math.max(bw, R * (0.1 + 0.5 * ENV[(i * 5) % N]) * (1 + fx.live[i] * 0.55));
    const r = R + h / 2 + 6;
    put(out, i, cx + Math.cos(th) * r, cy + Math.sin(th) * r, bw, h, th - Math.PI / 2, 1);
  }
}

/* ───────── silêncio: uma linha de pontos ───────── */
export function lineLayout(W, H, out) {
  const m = W * 0.1;
  const step = (W - 2 * m) / (N - 1);
  for (let i = 0; i < N; i++) put(out, i, m + i * step, H * 0.4, 3.2, 3.2, 0, 0.55);
}

export function layoutInto(name, W, H, out, fx) {
  switch (name) {
    case 'logo': return logoLayout(W, H, out);
    case 'wave': return waveLayout(W, H, out, fx);
    case 'clusters': return clustersLayout(W, H, out, fx);
    case 'radial': return radialLayout(W, H, out, fx);
    case 'line': return lineLayout(W, H, out);
    default: throw new Error('layout desconhecido: ' + name);
  }
}

/** Interpola A→B com escalonamento do centro para as pontas (a mudança "abre" como uma onda). */
export function tween(A, B, m, out) {
  for (let i = 0; i < N; i++) {
    const s = Math.abs(i - (N - 1) / 2) / (N / 2);
    const t = smooth(0, 1, clamp(m * 1.5 - s * 0.5, 0, 1));
    const o = i * STRIDE;
    for (let k = 0; k < STRIDE; k++) out[o + k] = lerp(A[o + k], B[o + k], t);
  }
}
