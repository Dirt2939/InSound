import { storage } from '../lib/store.js';
import { getHistory } from '../services/history.js';

/**
 * Provider Audius — API pública, sem chave e sem login. Músicas completas, tocáveis num <audio>.
 * Doc: https://docs.audius.co  (app_name identifica o app; é recomendado pela Audius)
 */
const BASE = 'https://api.audius.co/v1';
const APP = 'InSound';

async function get(path, query = {}) {
  const url = new URL(BASE + path);
  url.searchParams.set('app_name', APP);
  for (const [k, v] of Object.entries(query)) v != null && url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Audius respondeu ${res.status}`);
  return (await res.json()).data;
}

const compact = (list) => (list || []).filter(Boolean);
const uniqBy = (list, key) => {
  const seen = new Set();
  return list.filter((x) => x && !seen.has(key(x)) && seen.add(key(x)));
};
const pic = (sizes, size = '480x480') => sizes?.[size] || sizes?.['480x480'] || sizes?.['150x150'] || sizes?.['1000x1000'] || null;

export function mapTrack(t) {
  if (!t || !t.id || t.is_streamable === false || t.is_delete) return null;
  const u = t.user || {};
  return {
    id: t.id,
    uri: `audius:track:${t.id}`,
    kind: 'track',
    title: t.title,
    artist: u.name || 'Artista',
    subtitle: u.name || 'Artista',
    artists: [{ id: u.id, name: u.name }],
    album: '',
    albumId: null,
    cover: pic(t.artwork),
    coverLarge: pic(t.artwork, '1000x1000'),
    duration: Math.round((t.duration || 0) * 1000),
    url: t.permalink ? `https://audius.co${t.permalink}` : undefined,
    streamUrl: `${BASE}/tracks/${encodeURIComponent(t.id)}/stream?app_name=${APP}`,
  };
}

const mapUser = (u) =>
  u && u.id && {
    id: u.id,
    uri: `audius:user:${u.id}`,
    kind: 'artist',
    title: u.name,
    subtitle: 'Artista',
    cover: pic(u.profile_picture),
    coverLarge: pic(u.profile_picture, '1000x1000'),
    url: u.handle ? `https://audius.co/${u.handle}` : undefined,
  };

const mapPlaylist = (p) =>
  p && p.id && !p.is_delete && !p.is_private && {
    id: p.id,
    uri: `audius:playlist:${p.id}`,
    kind: p.is_album ? 'album' : 'playlist',
    title: p.playlist_name,
    subtitle: p.user?.name ? `de ${p.user.name}` : p.is_album ? 'Álbum' : 'Playlist',
    artist: p.user?.name,
    cover: pic(p.artwork),
    coverLarge: pic(p.artwork, '1000x1000'),
    trackCount: p.track_count,
    url: p.permalink ? `https://audius.co${p.permalink}` : undefined,
  };

/* curtidas locais (o Audius não tem conta aqui; guardamos as faixas inteiras) */
const LIKED = 'audius:liked';
const likedTracks = () => storage.get(LIKED, []);

export const audiusProvider = {
  id: 'audius',

  async getUser() {
    return { id: 'audius', name: 'Você', image: null, product: 'audius' };
  },

  async getHome() {
    const [week, month] = await Promise.all([
      get('/tracks/trending', { time: 'week', limit: 20 }),
      get('/tracks/trending', { time: 'month', limit: 20 }).catch(() => []),
    ]);
    const top = compact(week.map(mapTrack)).slice(0, 10);
    const history = getHistory();
    const recents = history.length >= 3 ? history.slice(0, 12) : uniqBy([...history, ...compact(month.map(mapTrack))], (t) => t.id).slice(0, 12);
    return { top, recents, topTitle: 'Em alta esta semana', recentsTitle: history.length >= 3 ? 'Recentes' : 'Em alta no mês' };
  },

  async search(q, type = 'all') {
    const want = (t) => type === 'all' || type === t;
    const [tr, pl, us] = await Promise.all([
      want('tracks') ? get('/tracks/search', { query: q, limit: 10 }) : [],
      want('albums') || want('playlists') ? get('/playlists/search', { query: q, limit: 20 }) : [],
      want('artists') ? get('/users/search', { query: q, limit: 10 }) : [],
    ]);
    const lists = compact(pl.map(mapPlaylist));
    return {
      tracks: compact(tr.map(mapTrack)),
      albums: lists.filter((x) => x.kind === 'album'),
      playlists: lists.filter((x) => x.kind === 'playlist'),
      artists: compact(us.map(mapUser)),
    };
  },

  async getSuggestions() {
    const [trend, under] = await Promise.all([
      get('/tracks/trending', { limit: 30 }),
      get('/tracks/trending/underground', { limit: 6 }).catch(() => []),
    ]);
    return {
      artists: uniqBy(compact(trend.map((t) => mapUser(t.user))), (a) => a.id).slice(0, 10),
      tracks: compact(under.map(mapTrack)),
    };
  },

  async getLibrary() {
    const [pls, trend] = await Promise.all([
      get('/playlists/trending', { limit: 30 }).catch(() => []),
      get('/tracks/trending', { time: 'month', limit: 30 }).catch(() => []),
    ]);
    const all = compact(pls.map(mapPlaylist));
    return {
      playlists: all.filter((p) => p.kind === 'playlist'),
      albums: all.filter((p) => p.kind === 'album'),
      liked: likedTracks(),
      recents: getHistory(),
      artists: uniqBy(compact(trend.map((t) => mapUser(t.user))), (a) => a.id),
    };
  },

  async getCollection(kind, id) {
    if (kind === 'liked') {
      return { id: 'liked', kind: 'playlist', title: 'Músicas curtidas', subtitle: 'Sua coleção', cover: null, tracks: likedTracks() };
    }
    if (kind === 'artist') {
      const [u, tr] = await Promise.all([get(`/users/${id}`), get(`/users/${id}/tracks`, { limit: 30 })]);
      return { ...mapUser(u), tracks: compact(tr.map(mapTrack)) };
    }
    // playlist | album
    const [meta, tr] = await Promise.all([get(`/playlists/${id}`), get(`/playlists/${id}/tracks`)]);
    const p = mapPlaylist(Array.isArray(meta) ? meta[0] : meta);
    if (!p) return null;
    const tracks = compact(tr.map(mapTrack));
    return { ...p, trackCount: tracks.length, tracks };
  },

  async isLiked(ids) {
    const have = new Set(likedTracks().map((t) => t.id));
    return ids.map((id) => have.has(id));
  },

  async setLiked(track, value) {
    const { queued, ...clean } = track;
    void queued;
    const rest = likedTracks().filter((t) => t.id !== track.id);
    storage.set(LIKED, (value ? [clean, ...rest] : rest).slice(0, 500));
  },
};
