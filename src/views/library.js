import { h, clear } from '../lib/dom.js';
import { icon } from '../components/icons.js';
import { art } from '../components/art.js';
import { trackRow, collectionRow } from '../components/trackRow.js';
import { skeletonRows, emptyState, bindNowPlaying, errorState } from '../components/ui.js';
import { openSettings } from './settings.js';
import { navigate } from '../router.js';
import { music } from '../services/music.js';
import { session } from '../services/session.js';
import { player } from '../player/player.js';
import { plural } from '../lib/format.js';

const FILTERS = [
  { id: 'playlists', label: 'Playlists', icon: 'library' },
  { id: 'liked', label: 'Curtidas', icon: 'heart' },
  { id: 'recents', label: 'Recentes', icon: 'clock' },
  { id: 'albums', label: 'Álbuns', icon: 'disc' },
  { id: 'artists', label: 'Artistas', icon: 'user' },
];

let current = 'playlists';

export function libraryView() {
  const unsubs = [];
  const content = h('div', { class: 'lib-content' }, skeletonRows(5));
  let data = null;

  const avatar = h('button', { class: 'avatar', 'aria-label': 'Perfil e configurações', onclick: openSettings });
  const paintAvatar = (u) => {
    clear(avatar);
    if (u?.image) avatar.append(art(u.image, { cls: 'avatar-art', round: true }));
    else avatar.append(icon('user', 20));
  };
  paintAvatar(session.get().user);
  unsubs.push(session.subscribe((s) => paintAvatar(s.user)));

  const menu = h('nav', { class: 'lib-menu', 'aria-label': 'Filtros da biblioteca' },
    FILTERS.map((f, i) =>
      h('button', { class: 'lib-item', dataset: { id: f.id }, style: { '--i': i }, onclick: () => select(f.id) },
        icon(f.icon, 20), h('span', {}, f.label),
      ),
    ),
  );

  const el = h('div', { class: 'view-inner library' },
    h('header', { class: 'top' }, h('h1', { class: 'top-title' }, 'Biblioteca'), avatar),
    menu,
    h('div', { class: 'divider' }),
    content,
  );

  function select(id) {
    current = id;
    menu.querySelectorAll('.lib-item').forEach((b) => b.classList.toggle('is-active', b.dataset.id === id));
    render();
  }

  function render() {
    unsubs.slice(1).forEach((u) => u());
    unsubs.length = 1;
    clear(content);
    if (!data) return content.append(skeletonRows(5));
    const f = FILTERS.find((x) => x.id === current);
    content.append(h('div', { class: 'lib-title' }, f.label));
    const list = h('div', { class: 'list' });
    const open = (x) => navigate(`/c/${x.kind}/${x.id}`);

    if (current === 'playlists') {
      const likedRow = collectionRow({ id: 'liked', kind: 'playlist', title: 'Músicas curtidas', subtitle: 'Sua coleção', cover: null }, { index: 0, onOpen: () => navigate('/c/liked/liked') });
      likedRow.querySelector('.row-art').replaceWith(h('div', { class: 'row-art liked-tile' }, icon('heart-fill', 22)));
      list.append(
        likedRow,
        ...data.playlists.map((p, i) =>
          collectionRow(p, { index: i + 1, subtitle: p.trackCount != null ? plural(p.trackCount, 'música', 'músicas') : p.subtitle, onOpen: open }),
        ),
      );
    } else if (current === 'albums') data.albums.forEach((a, i) => list.append(collectionRow(a, { index: i, onOpen: open })));
    else if (current === 'artists') data.artists.forEach((a, i) => list.append(collectionRow(a, { index: i, onOpen: open })));
    else {
      const tracks = current === 'liked' ? data.liked : data.recents;
      tracks.forEach((t, i) => list.append(trackRow(t, { index: i, onPlay: () => player.playTracks(tracks, i, f.label) })));
      unsubs.push(bindNowPlaying(content));
    }
    if (!list.children.length) {
      content.append(emptyState({ title: 'Nada por aqui ainda', text: 'Quando você salvar algo, aparece nesta lista.' }));
    } else content.append(list);
  }

  async function load() {
    try {
      data = await music.getLibrary();
      render();
    } catch (err) {
      console.error(err);
      clear(content).append(errorState(load));
    }
  }

  select(current);
  load();
  return { el, destroy: () => unsubs.forEach((u) => u()) };
}
