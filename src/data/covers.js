import { rng } from '../lib/format.js';

const cache = new Map();

/** Capa generativa colorida (SVG) — usada no modo demo. Determinística por seed. */
export function coverArt(seed) {
  if (cache.has(seed)) return cache.get(seed);
  const r = rng(seed);
  const hue = Math.floor(r() * 360);
  const h2 = (hue + 35 + Math.floor(r() * 70)) % 360;
  const c1 = `hsl(${hue} 72% 56%)`;
  const c2 = `hsl(${h2} 78% 38%)`;
  const c3 = `hsl(${(hue + 200) % 360} 55% 16%)`;
  const lt = `hsl(${(hue + 18) % 360} 92% 84%)`;
  const motif = Math.floor(r() * 5);
  let g = '';

  if (motif === 0) {
    const sy = 110 + r() * 50;
    g = `<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c3}"/></linearGradient></defs>
      <rect width="300" height="300" fill="url(#a)"/>
      <circle cx="${120 + r() * 60}" cy="${sy}" r="${48 + r() * 24}" fill="${lt}"/>
      <path d="M0 220 L60 ${150 + r() * 30} L120 210 L190 ${140 + r() * 30} L300 225 V300 H0Z" fill="${c2}" opacity=".92"/>
      <path d="M0 260 L80 ${210 + r() * 20} L160 255 L240 ${215 + r() * 20} L300 258 V300 H0Z" fill="${c3}"/>`;
  } else if (motif === 1) {
    const cx = 110 + r() * 80, cy = 110 + r() * 80;
    g = `<rect width="300" height="300" fill="${c3}"/>`;
    for (let i = 6; i >= 1; i--) g += `<circle cx="${cx + (6 - i) * 4}" cy="${cy}" r="${i * 24}" fill="${i % 2 ? c1 : c2}"/>`;
    g += `<circle cx="${cx + 20}" cy="${cy}" r="14" fill="${lt}"/>`;
  } else if (motif === 2) {
    g = `<rect width="300" height="300" fill="${c2}"/>
      <g transform="rotate(${-20 + r() * 40} 150 150)">
      <rect x="-40" y="${40 + r() * 40}" width="380" height="70" fill="${c1}"/>
      <rect x="-40" y="${150 + r() * 30}" width="380" height="46" fill="${c3}"/>
      <rect x="-40" y="${230 + r() * 20}" width="380" height="90" fill="${lt}" opacity=".85"/></g>
      <circle cx="${70 + r() * 160}" cy="${70 + r() * 160}" r="${34 + r() * 20}" fill="${lt}"/>`;
  } else if (motif === 3) {
    g = `<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="30"/></filter></defs>
      <rect width="300" height="300" fill="${c3}"/>
      <g filter="url(#b)">
      <circle cx="${60 + r() * 60}" cy="${70 + r() * 80}" r="${70 + r() * 30}" fill="${c1}"/>
      <circle cx="${180 + r() * 80}" cy="${160 + r() * 100}" r="${80 + r() * 30}" fill="${c2}"/>
      <circle cx="${120 + r() * 80}" cy="${200 + r() * 60}" r="${40 + r() * 30}" fill="${lt}"/></g>`;
  } else {
    g = `<rect width="300" height="300" fill="${c3}"/>`;
    const cols = [c2, c1, lt, c2];
    for (let i = 0; i < 4; i++) {
      const y = 90 + i * 48, a = 14 + r() * 22, ph = r() * 6;
      let d = `M0 ${y}`;
      for (let x = 0; x <= 300; x += 20) d += ` L${x} ${(y + Math.sin(x / 38 + ph) * a).toFixed(1)}`;
      g += `<path d="${d} V300 H0Z" fill="${cols[i]}" opacity="${i === 2 ? 0.9 : 1}"/>`;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">${g}</svg>`;
  const uri = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  cache.set(seed, uri);
  return uri;
}
