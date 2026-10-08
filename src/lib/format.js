export function fmtTime(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtTotal(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}min`;
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}min`;
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** PRNG determinístico (mulberry32) para capas e waveforms estáveis. */
export function rng(seed) {
  let a = hash(seed) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
