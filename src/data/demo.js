import { coverArt } from './covers.js';
import { storage } from '../lib/store.js';

/* ───────── catálogo de demonstração (sem áudio; só metadados) ───────── */

// [título, artista, álbum, duração em segundos]
const RAW = [
  ['After Hours', 'The Weeknd', 'After Hours', 361],
  ['Blinding Lights', 'The Weeknd', 'After Hours', 200],
  ['Save Your Tears', 'The Weeknd', 'After Hours', 215],
  ['NEW MAGIC WAND', 'Tyler, The Creator', 'IGOR', 195],
  ['EARFQUAKE', 'Tyler, The Creator', 'IGOR', 190],
  ['A BOY IS A GUN*', 'Tyler, The Creator', 'IGOR', 216],
  ['drivers license', 'Olivia Rodrigo', 'SOUR', 242],
  ['good 4 u', 'Olivia Rodrigo', 'SOUR', 178],
  ['deja vu', 'Olivia Rodrigo', 'SOUR', 215],
  ['The Less I Know The Better', 'Tame Impala', 'Currents', 216],
  ['Let It Happen', 'Tame Impala', 'Currents', 467],
  ['Do I Wanna Know?', 'Arctic Monkeys', 'AM', 272],
  ['R U Mine?', 'Arctic Monkeys', 'AM', 201],
  ['I Wanna Be Yours', 'Arctic Monkeys', 'AM', 183],
  ['505', 'Arctic Monkeys', 'Favourite Worst Nightmare', 253],
  ["Why'd You Only Call Me When You're High?", 'Arctic Monkeys', 'AM', 161],
  ['Still Take You Home', 'Arctic Monkeys', 'Whatever People Say I Am', 173],
  ['Maybe Tomorrow', 'Stereophonics', 'You Gotta Go There to Come Back', 204],
  ['Inverno', 'Emicida', 'O Dia Que a Terra Parou', 241],
  ['Inverno (Ao Vivo)', 'Emicida', 'Ao Vivo', 258],
  ['Tão Bem', 'Tiago Iorc', 'Troco Likes por Beijos', 198],
  ['Sparks', 'Coldplay', 'Parachutes', 227],
  ['Yellow', 'Coldplay', 'Parachutes', 269],
  ['Weightless', 'Marconi Union', 'Weightless', 480],
  ['Space Song', 'Beach House', 'Depression Cherry', 320],
  ['Nuvole Bianche', 'Ludovico Einaudi', 'Una Mattina', 357],
  ['The Night We Met', 'Lord Huron', 'Strange Trails', 208],
  ['Ho Hey', 'The Lumineers', 'The Lumineers', 163],
  ['Skinny Love', 'Bon Iver', 'For Emma, Forever Ago', 238],
  ['Retrato em Branco e Preto', 'Tom Jobim', 'Stone Flower', 192],
  ['Garota de Ipanema', 'Tom Jobim', 'Getz/Gilberto', 306],
  ['Trem-Bala', 'Ana Vilela', 'Trem-Bala', 210],
  ['Evidências', 'Chitãozinho & Xororó', 'Cowboy do Asfalto', 270],
  ['Chico Mineiro', 'Tonico & Tinoco', 'Raízes', 184],
  ['Tocando em Frente', 'Almir Sater', 'Instrumental', 228],
  ['Rei do Gado', 'Pena Branca & Xavantinho', 'Cio da Terra', 235],
];

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const artistMap = new Map();
const albumMap = new Map();

export const tracks = RAW.map(([title, artist, album, sec], i) => {
  const artistId = 'ar-' + slug(artist);
  const albumId = 'al-' + slug(album);
  if (!artistMap.has(artistId)) {
    artistMap.set(artistId, { id: artistId, kind: 'artist', title: artist, subtitle: 'Artista', cover: coverArt('artist:' + artist) });
  }
  if (!albumMap.has(albumId)) {
    albumMap.set(albumId, { id: albumId, kind: 'album', title: album, subtitle: artist, artist, cover: coverArt('album:' + album), trackIds: [] });
  }
  const t = {
    id: 't' + i,
    uri: 'demo:track:' + i,
    kind: 'track',
    title,
    artist,
    artists: [{ id: artistId, name: artist }],
    album,
    albumId,
    cover: albumMap.get(albumId).cover,
    duration: sec * 1000,
  };
  albumMap.get(albumId).trackIds.push(t.id);
  return t;
});

const byId = new Map(tracks.map((t) => [t.id, t]));
const pick = (...ids) => ids.map((i) => tracks[i]);

export const albums = [...albumMap.values()];
export const artists = [...artistMap.values()];

export const playlists = [
  { id: 'pl-fav', kind: 'playlist', title: 'Favoritas', subtitle: '312 músicas', cover: coverArt('pl:fav'), tracks: tracks.slice(0, 20) },
  { id: 'pl-relax', kind: 'playlist', title: 'Pra relaxar', subtitle: '58 músicas', cover: coverArt('pl:relax'), tracks: pick(23, 24, 25, 26, 27, 28, 29, 17) },
  { id: 'pl-foco', kind: 'playlist', title: 'Foco', subtitle: '42 músicas', cover: coverArt('pl:foco'), tracks: pick(23, 25, 24, 28, 26, 22) },
  { id: 'pl-raiz', kind: 'playlist', title: 'Sertanejo (raiz)', subtitle: '87 músicas', cover: coverArt('pl:raiz'), tracks: pick(33, 34, 35, 36, 32) },
];
for (const p of playlists) p.trackCount = p.tracks.length;

/* ───────── "provider" demo: mesma interface do provider Spotify ───────── */

const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

const likedIds = new Set(storage.get('demo:liked', ['t0', 't11', 't14', 't22']));
const persistLiked = () => storage.set('demo:liked', [...likedIds]);
const recentIds = ['t9', 't11', 't14', 't4', 't6', 't18', 't20', 't21'];

export const demoProvider = {
  id: 'demo',

  async getUser() {
    return { id: 'demo', name: 'Você', image: null, product: 'demo' };
  },

  async getHome() {
    await delay();
    return {
      top: [albumMap.get('al-after-hours'), albumMap.get('al-igor'), albumMap.get('al-sour'), albumMap.get('al-am'), albumMap.get('al-currents'), albumMap.get('al-parachutes')],
      recents: recentIds.map((id) => byId.get(id)),
    };
  },

  async search(q, type = 'all') {
    await delay(160);
    const n = slug(q).replace(/-/g, '');
    const has = (...s) => s.some((x) => slug(x).replace(/-/g, '').includes(n));
    const res = {
      tracks: tracks.filter((t) => has(t.title, t.artist, t.album)),
      albums: albums.filter((a) => has(a.title, a.subtitle)),
      artists: artists.filter((a) => has(a.title)),
      playlists: playlists.filter((p) => has(p.title)),
    };
    if (type !== 'all') return { ...{ tracks: [], albums: [], artists: [], playlists: [] }, [type]: res[type] };
    return res;
  },

  async getSuggestions() {
    await delay(100);
    return { artists: artists.slice(0, 8), tracks: tracks.slice(9, 14) };
  },

  async getLibrary() {
    await delay();
    return {
      playlists,
      liked: [...likedIds].map((id) => byId.get(id)).filter(Boolean),
      recents: recentIds.map((id) => byId.get(id)),
      albums,
      artists,
    };
  },

  async getCollection(kind, id) {
    await delay();
    if (kind === 'playlist') {
      const p = playlists.find((x) => x.id === id);
      return p && { ...p, tracks: p.tracks };
    }
    if (kind === 'album') {
      const a = albumMap.get(id);
      return a && { ...a, tracks: a.trackIds.map((i) => byId.get(i)) };
    }
    if (kind === 'artist') {
      const a = artistMap.get(id);
      return a && { ...a, tracks: tracks.filter((t) => t.artists[0].id === id) };
    }
    if (kind === 'liked') {
      const list = [...likedIds].map((i) => byId.get(i)).filter(Boolean);
      return { id: 'liked', kind: 'playlist', title: 'Músicas curtidas', subtitle: 'Sua coleção', cover: coverArt('liked'), tracks: list };
    }
    return null;
  },

  async isLiked(ids) {
    return ids.map((i) => likedIds.has(i));
  },

  async setLiked(track, value) {
    if (value) likedIds.add(track.id);
    else likedIds.delete(track.id);
    persistLiked();
  },
};
