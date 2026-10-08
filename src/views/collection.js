import { h, clear } from '../lib/dom.js';
import { icon } from '../components/icons.js';
import { art } from '../components/art.js';
import { trackRow } from '../components/trackRow.js';
import { skeletonRows, emptyState, bindNowPlaying, errorState } from '../components/ui.js';
import { openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import { back } from '../router.js';
import { music, ensureLikes } from '../services/music.js';
import { player } from '../player/player.js';
import { fmtTotal, plural } from '../lib/format.js';
import { share, haptic } from '../platform.js';

export function collectionView({ kind, id }) {
  const unsubs = [];
  const host = h('div', { class: 'col-host' });
  const topBtn = (name, label, fn) => h('button', { class: 'icon-btn', 'aria-label': label, onclick: fn }, icon(name, 24));

  const bar = h('div', { class: 'col-bar' },
    topBtn('chev-left', 'Voltar', () => back()),
    h('div', { class: 'col-bar-title' }),
    topBtn('more-v', 'Mais opções', () => menu()),
  );
  const el = h('div', { class: 'view-inner collection' }, bar, host);
  host.append(h('div', { class: 'col-hero' }, h('div', { class: 'skel skel-hero' })), skeletonRows(5));

  let col = null;

  function menu() {
    if (!col) return;
    openSheet({
      title: col.title,
      subtitle: col.subtitle,
      cover: col.cover,
      items: [
        { icon: 'plus', label: 'Adicionar tudo à fila', onClick: () => (col.tracks.forEach((t) => player.enqueue(t)), toast('Adicionadas à fila')) },
        { icon: 'share', label: 'Compartilhar', onClick: doShare },
      ],
    });
  }

  async function doShare() {
    const url = col.url || location.href;
    const r = await share({ title: col.title, url });
    if (r === 'copied') toast('Link copiado');
  }

  function render() {
    clear(host);
    const tracks = col.tracks || [];
    const total = tracks.reduce((a, t) => a + (t.duration || 0), 0);
    const meta = kind === 'artist'
      ? `Artista${tracks.length ? ` · ${plural(tracks.length, 'música popular', 'músicas populares')}` : ''}`
      : `${plural(tracks.length, 'música', 'músicas')}${total ? ` · ${fmtTotal(total)}` : ''}`;

    const playBtn = h('button', { class: 'play-fab', 'aria-label': 'Tocar', onclick: () => { haptic('medium'); tracks.length && player.playTracks(tracks, 0, col.title); } }, icon('play', 28));
    const shuffleBtn = action('shuffle', 'Aleatório', () => { player.setShuffle(true); tracks.length && player.playTracks(tracks, Math.floor(Math.random() * tracks.length), col.title); });
    const shareBtn = action('share', 'Compartilhar', doShare);
    const queueBtn = action('plus', 'Fila', () => { tracks.forEach((t) => player.enqueue(t)); toast('Adicionadas à fila'); });

    const hero = h('div', { class: 'col-hero' },
      h('div', { class: 'col-cover-wrap' }, art(col.cover, { cls: 'col-cover', round: kind === 'artist' })),
      h('h1', { class: 'col-title' }, col.title),
      h('div', { class: 'col-meta' }, meta),
      playBtn,
      h('div', { class: 'col-actions' }, shuffleBtn, shareBtn, queueBtn),
    );

    const list = h('div', { class: 'list' });
    const isAlbum = kind === 'album';
    tracks.forEach((t, i) =>
      list.append(trackRow(t, { index: i, cover: !isAlbum, number: isAlbum ? i + 1 : null, subtitle: isAlbum ? t.artist : t.artist, onPlay: () => player.playTracks(tracks, i, col.title) })),
    );
    host.append(hero, tracks.length ? list : emptyState({ title: 'Sem músicas', text: 'Esta coleção está vazia.' }));
    ensureLikes(tracks.slice(0, 50));
    unsubs.push(bindNowPlaying(host));
    bar.querySelector('.col-bar-title').textContent = col.title;
    wireScroll();
  }

  function action(name, label, fn) {
    return h('button', { class: 'col-action', onclick: fn }, icon(name, 22), h('span', {}, label));
  }

  // parallax suave da capa + título na barra ao rolar
  let scroller = null;
  function wireScroll() {
    scroller = el.closest('.view');
    if (!scroller) return queueMicrotask(wireScroll);
    const hero = host.querySelector('.col-cover-wrap');
    const onScroll = () => {
      const y = scroller.scrollTop;
      const p = Math.min(1, Math.max(0, y / 220));
      hero?.style.setProperty('--p', p.toFixed(3));
      bar.classList.toggle('is-solid', y > 200);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    unsubs.push(() => scroller.removeEventListener('scroll', onScroll));
    onScroll();
  }

  async function load() {
    try {
      col = await music.getCollection(kind, id);
      if (!col) {
        clear(host).append(emptyState({ title: 'Não encontramos isso', action: { label: 'Voltar', onClick: () => back() } }));
        return;
      }
      render();
    } catch (err) {
      console.error(err);
      clear(host).append(errorState(load));
    }
  }
  load();
  return { el, destroy: () => unsubs.forEach((u) => u()) };
}
