import { getAccessToken } from './auth.js';

const BASE = 'https://api.spotify.com/v1';

export class SpotifyError extends Error {
  constructor(status, message, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

/** fetch autenticado com retry em 429 (respeitando Retry-After) e 1 retry em 401. */
export async function api(path, { method = 'GET', query, body, retries = 2 } = {}) {
  const url = new URL(path.startsWith('http') ? path : BASE + path);
  if (query) for (const [k, v] of Object.entries(query)) v != null && url.searchParams.set(k, v);

  for (let attempt = 0; ; attempt++) {
    const token = await getAccessToken();
    if (!token) throw new SpotifyError(401, 'Sessão expirada. Entre novamente.');
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 429 && attempt < retries) {
      const wait = Math.min(8, Number(res.headers.get('Retry-After') || 1));
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (res.status === 204 || res.status === 202) return null;
    if (res.ok) {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    }
    const err = await res.json().catch(() => ({}));
    throw new SpotifyError(res.status, err?.error?.message || `Erro ${res.status}`, res.headers.get('Retry-After'));
  }
}
