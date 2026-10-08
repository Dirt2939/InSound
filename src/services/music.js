import { createStore } from '../lib/store.js';

/**
 * Fachada de dados: as views só falam com `music`, que delega ao provider ativo
 * (demo ou Spotify). Inclui um cache curto para evitar skeletons ao voltar entre abas.
 */
let provider = null;
const memo = new Map();
const TTL = 60_000;

export function setProvider(p) {
  provider = p;
  memo.clear();
}
export const getProvider = () => provider;

async function cached(key, fn) {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const value = await fn();
  memo.set(key, { at: Date.now(), value });
  return value;
}

export const music = {
  invalidate: () => memo.clear(),
  getHome: () => cached('home', () => provider.getHome()),
  getLibrary: () => cached('library', () => provider.getLibrary()),
  getSuggestions: () => cached('suggestions', () => provider.getSuggestions()),
  getCollection: (kind, id) => cached(`c:${kind}:${id}`, () => provider.getCollection(kind, id)),
  search: (q, type) => provider.search(q, type),
};

/* ───────── curtidas: cache local + atualização otimista ───────── */
export const likesStore = createStore({ v: 0 });
const likes = new Map(); // trackId -> boolean

export const isLiked = (id) => likes.get(id) === true;

export async function ensureLikes(tracks) {
  const missing = tracks.filter((t) => t.kind === 'track' && !likes.has(t.id));
  if (!missing.length || !provider) return;
  try {
    const res = await provider.isLiked(missing.map((t) => t.id));
    missing.forEach((t, i) => likes.set(t.id, !!res[i]));
    likesStore.set((s) => ({ v: s.v + 1 }));
  } catch {}
}

export async function toggleLike(track) {
  const next = !isLiked(track.id);
  likes.set(track.id, next);
  likesStore.set((s) => ({ v: s.v + 1 }));
  try {
    await provider.setLiked(track, next);
    memo.delete('library');
    memo.delete('c:liked:liked');
    return next;
  } catch (err) {
    likes.set(track.id, !next);
    likesStore.set((s) => ({ v: s.v + 1 }));
    throw err;
  }
}
