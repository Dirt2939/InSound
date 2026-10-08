const cache = new Map();

/** Cor média (RGB) de uma imagem, para o brilho ambiente. Falha silenciosa (CORS). */
export function dominantColor(src) {
  if (cache.has(src)) return Promise.resolve(cache.get(src));
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 16;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 16, 16);
        const d = ctx.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          const max = Math.max(d[i], d[i + 1], d[i + 2]);
          const min = Math.min(d[i], d[i + 1], d[i + 2]);
          const w = 0.25 + (max - min) / 255; // favorece pixels saturados
          r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; n += w;
        }
        const rgb = [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
        cache.set(src, rgb);
        resolve(rgb);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
