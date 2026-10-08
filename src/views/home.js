import { h, clear } from '../lib/dom.js';
import { icon } from '../components/icons.js';
import { art } from '../components/art.js';
import { trackRow } from '../components/trackRow.js';
import { sectionHead, skeletonCards, skeletonRows, bindNowPlaying, errorState } from '../components/ui.js';
import { openSheet } from '../components/sheet.js';
import { navigate } from '../router.js';
import { music } from '../services/music.js';
import { player } from '../player/player.js';
import { greeting } from '../lib/format.js';
import { haptic } from '../platform.js';
import { session } from '../services/session.js';

export function homeView() {
  const topHost = h('div', { class: 'home-top' }, skeletonCards(3));
  const recentHost = h('div', { class: 'home-recent' }, skeletonRows(4));
  const unsubs = [];

  const bell = h('button', {
    class: 'icon-btn',
    'aria-label': 'Novidades',
    onclick: () =>
      openSheet({
        title: 'Novidades',
        content: h('div', { class: 'empty empty-sheet' },
          h('div', { class: 'empty-title' }, 'Tudo em dia'),
          h('div', { class: 'empty-text' }, 'Quando houver algo novo para você, aparece aqui.'),
        ),
      }),
  }, icon('bell', 24));

  const el = h('div', { class: 'view-inner home' },
    h('header', { class: 'top' },
      h('div', {}, h('div', { class: 'top-eyebrow' }, greeting()), h('h1', { class: 'top-title' }, 'Início')),
      bell,
    ),
    h('button', { class: 'searchbar', onclick: () => ((sessionStorage.__focusSearch = '1'), navigate('/search')) },
      icon('search', 20),
      h('span', {}, 'Buscar músicas, artistas, álbuns...'),
    ),
    topHost,
    recentHost,
  );

  async function load() {
    try {
      const home = await music.getHome();
      renderTop(home.top, home.topTitle);
      renderRecents(home.recents, home.recentsTitle);
    } catch (err) {
      console.error(err);
      clear(topHost).append(errorState(load));
      clear(recentHost);
    }
  }

  function renderTop(items, title) {
    clear(topHost);
    if (!items?.length) return;
    let grid = false;
    const list = h('div', { class: 'cards' });
    const toggle = { label: 'Ver tudo', onClick: () => {} };
    const head = sectionHead(title || (session.get().mode === 'spotify' ? 'Mais ouvidas' : 'Mais ouvidas hoje'), toggle);
    const btn = head.querySelector('.link-btn');
    btn.onclick = () => {
      grid = !grid;
      list.classList.toggle('as-grid', grid);
      btn.textContent = grid ? 'Ver menos' : 'Ver tudo';
    };
    items.forEach((it, i) => {
      const open = () => {
        haptic();
        if (it.kind === 'track') player.playTracks(items.filter((x) => x.kind === 'track'), items.indexOf(it), 'Mais ouvidas');
        else navigate(`/c/${it.kind}/${it.id}`);
      };
      list.append(
        h('button', { class: 'card', style: { '--i': i }, onclick: open },
          art(it.cover, { cls: 'card-art' }),
          h('div', { class: 'card-title' }, it.title),
          h('div', { class: 'card-sub' }, it.subtitle),
        ),
      );
    });
    topHost.append(head, list);
  }

  function renderRecents(tracks, title) {
    clear(recentHost);
    if (!tracks?.length) return;
    let all = false;
    const list = h('div', { class: 'list' });
    const head = sectionHead(title || 'Recentes', { label: 'Ver tudo', onClick: () => {} });
    const btn = head.querySelector('.link-btn');
    const draw = () => {
      clear(list);
      (all ? tracks : tracks.slice(0, 5)).forEach((t, i) =>
        list.append(trackRow(t, { index: i, onPlay: () => player.playTracks(tracks, tracks.indexOf(t), title || 'Recentes') })),
      );
      btn.textContent = all ? 'Ver menos' : 'Ver tudo';
      btn.style.display = tracks.length > 5 ? '' : 'none';
      unsubs.forEach((u) => u());
      unsubs.length = 0;
      unsubs.push(bindNowPlaying(recentHost));
    };
    btn.onclick = () => ((all = !all), draw());
    recentHost.append(head, list);
    draw();
  }

  load();
  return { el, destroy: () => unsubs.forEach((u) => u()) };
}
