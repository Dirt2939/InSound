import { api, SpotifyError } from './api.js';

/* ───────── normalização (Spotify → modelo interno) ───────── */
const imgs = (list) => list?.filter(Boolean) ?? [];
const mid = (list) => (imgs(list)[1] || imgs(list)[0])?.url || null;
const big = (list) => imgs(list)[0]?.url || null;
const names = (artists) => (artists || []).map((a) => a.name).join(', ');

export function mapTrack(t, album) {
  if (!t || !t.id || t.type === 'episode' || t.is_local) return null;
  const alb = t.album || album;
  return {
    id: t.id,
    uri: t.uri,
    kind: 'track',
    title: t.name,
    artist: names(t.artists),
    artists: (t.artists || []).map((a) => ({ id: a.id, name: a.name })),
    album: alb?.name || '',
    albumId: alb?.id || null,
    cover: mid(alb?.images),
    coverLarge: big(alb?.images),
    duration: t.duration_ms,
    url: t.external_urls?.spotify,
  };
}

const mapAlbum = (a) =>
  a && a.id && { id: a.id, uri: a.uri, kind: 'album', title: a.name, subtitle: names(a.artists), artist: names(a.artists), cover: mid(a.images), coverLarge: big(a.images), url: a.external_urls?.spotify };

const mapArtist = (a) =>
  a && a.id && { id: a.id, uri: a.uri, kind: 'artist', title: a.name, subtitle: 'Artista', cover: mid(a.images), coverLarge: big(a.images), url: a.external_urls?.spotify };

const mapPlaylist = (p) => {
  if (!p || !p.id) return null;
  const total = p.items?.total ?? p.tracks?.total;
  return {
    id: p.id,
    uri: p.uri,
    kind: 'playlist',
    title: p.name,
    subtitle: p.owner?.display_name ? `de ${p.owner.display_name}` : 'Playlist',
    cover: mid(p.images),
    coverLarge: big(p.images),
    trackCount: total,
    url: p.external_urls?.spotify,
  };
};

const uniqBy = (list, key) => {
  const seen = new Set();
  return list.filter((x) => x && !seen.has(key(x)) && seen.add(key(x)));
};
const compact = (list) => list.filter(Boolean);
const ok = (r, fallback) => (r.status === 'fulfilled' ? r.value : fallback);

async function pageAll(path, { query = {}, limit = 50, max = 200, pick }) {
  const out = [];
  for (let offset = 0; offset < max; offset += limit) {
    const page = await api(path, { query: { ...query, limit, offset } });
    const items = pick(page);
    out.push(...items);
    if (!page.next || items.length < limit) break;
  }
  return out;
}

export const spotifyProvider = {
  id: 'spotify',

  async getUser() {
    const me = await api('/me');
    return { id: me.id, name: me.display_name || me.id, image: imgs(me.images)[0]?.url || null, product: me.product || null };
  },

  async getHome() {
    const [top, recent, savedAlbums, saved] = await Promise.allSettled([
      api('/me/top/tracks', { query: { time_range: 'short_term', limit: 10 } }),
      api('/me/player/recently-played', { query: { limit: 30 } }),
      api('/me/albums', { query: { limit: 10 } }),
      api('/me/tracks', { query: { limit: 10 } }),
    ]);
    if ([top, recent, savedAlbums, saved].every((r) => r.status === 'rejected')) throw top.reason;

    let topItems = compact(ok(top, { items: [] }).items.map((t) => mapTrack(t)));
    if (topItems.length < 3) topItems = compact(ok(savedAlbums, { items: [] }).items.map((i) => mapAlbum(i.album)));

    let recents = uniqBy(compact(ok(recent, { items: [] }).items.map((i) => mapTrack(i.track))), (t) => t.id).slice(0, 12);
    if (!recents.length) recents = compact(ok(saved, { items: [] }).items.map((i) => mapTrack(i.track)));

    // para cards de faixa, o "subtitle" é o artista
    topItems.forEach((x) => x.kind === 'track' && (x.subtitle = x.artist));
    return { top: topItems, recents };
  },

  async search(q, type = 'all') {
    const types = type === 'all' ? 'track,album,artist,playlist' : { tracks: 'track', albums: 'album', artists: 'artist', playlists: 'playlist' }[type];
    const r = await api('/search', { query: { q, type: types, limit: 10 } });
    return {
      tracks: compact((r.tracks?.items || []).map((t) => mapTrack(t))),
      albums: compact((r.albums?.items || []).map(mapAlbum)),
      artists: compact((r.artists?.items || []).map(mapArtist)),
      playlists: compact((r.playlists?.items || []).map(mapPlaylist)),
    };
  },

  async getSuggestions() {
    const [artists, tracks] = await Promise.allSettled([
      api('/me/top/artists', { query: { time_range: 'medium_term', limit: 10 } }),
      api('/me/top/tracks', { query: { time_range: 'medium_term', limit: 6 } }),
    ]);
    return {
      artists: compact(ok(artists, { items: [] }).items.map(mapArtist)),
      tracks: compact(ok(tracks, { items: [] }).items.map((t) => mapTrack(t))),
    };
  },

  async getLibrary() {
    const [pl, liked, recent, albums, artists] = await Promise.allSettled([
      pageAll('/me/playlists', { max: 100, pick: (p) => p.items }),
      api('/me/tracks', { query: { limit: 50 } }),
      api('/me/player/recently-played', { query: { limit: 50 } }),
      api('/me/albums', { query: { limit: 50 } }),
      api('/me/following', { query: { type: 'artist', limit: 50 } }),
    ]);
    if ([pl, liked, recent, albums, artists].every((r) => r.status === 'rejected')) throw pl.reason;
    return {
      playlists: compact(ok(pl, []).map(mapPlaylist)),
      liked: compact(ok(liked, { items: [] }).items.map((i) => mapTrack(i.track))),
      recents: uniqBy(compact(ok(recent, { items: [] }).items.map((i) => mapTrack(i.track))), (t) => t.id),
      albums: compact(ok(albums, { items: [] }).items.map((i) => mapAlbum(i.album))),
      artists: compact((ok(artists, {}).artists?.items || []).map(mapArtist)),
    };
  },

  async getCollection(kind, id) {
    if (kind === 'liked') {
      const items = await pageAll('/me/tracks', { max: 200, pick: (p) => p.items });
      return { id: 'liked', kind: 'playlist', title: 'Músicas curtidas', subtitle: 'Sua coleção', cover: null, tracks: compact(items.map((i) => mapTrack(i.track))) };
    }
    if (kind === 'playlist') {
      const meta = await api(`/playlists/${id}`, { query: { fields: 'id,uri,name,images,owner(display_name),external_urls' } });
      let tracks = [];
      try {
        const items = await pageAll(`/playlists/${id}/items`, { limit: 50, max: 300, pick: (p) => p.items });
        tracks = compact(items.map((i) => mapTrack(i.item ?? i.track)));
      } catch (err) {
        // playlists de terceiros não expõem itens para apps em modo de desenvolvimento
        if (!(err instanceof SpotifyError) || ![403, 404].includes(err.status)) throw err;
      }
      return { ...mapPlaylist(meta), trackCount: tracks.length, tracks };
    }
    if (kind === 'album') {
      const a = await api(`/albums/${id}`);
      const base = mapAlbum(a);
      return { ...base, tracks: compact((a.tracks?.items || []).map((t) => mapTrack(t, a))) };
    }
    if (kind === 'artist') {
      const a = await api(`/artists/${id}`);
      const found = await api('/search', { query: { q: `artist:"${a.name}"`, type: 'track', limit: 10 } });
      const tracks = compact((found.tracks?.items || []).map((t) => mapTrack(t))).filter((t) => t.artists.some((x) => x.id === id));
      return { ...mapArtist(a), tracks };
    }
    return null;
  },

  async isLiked(ids) {
    const out = [];
    for (let i = 0; i < ids.length; i += 40) {
      const chunk = ids.slice(i, i + 40);
      const res = await api('/me/library/contains', { query: { uris: chunk.map((id) => `spotify:track:${id}`).join(',') } });
      out.push(...res);
    }
    return out;
  },

  async setLiked(track, value) {
    await api('/me/library', { method: value ? 'PUT' : 'DELETE', query: { uris: `spotify:track:${track.id}` } });
  },
};
