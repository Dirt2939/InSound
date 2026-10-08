import { h, clear } from '../lib/dom.js';
import { icon } from '../components/icons.js';
import { art } from '../components/art.js';
import { trackRow, collectionRow } from '../components/trackRow.js';
import { sectionHead, skeletonRows, emptyState, bindNowPlaying } from '../components/ui.js';
import { navigate } from '../router.js';
import { music } from '../services/music.js';
import { player } from '../player/player.js';
import { storage } from '../lib/store.js';

const TABS = [
  ['all', 'Tudo'],
  ['tracks', 'Músicas'],
  ['albums', 'Álbuns'],
  ['artists', 'Artistas'],
  ['playlists', 'Playlists'],
];

let memo = { q: '', type: 'all' }; // lembra a busca ao voltar para a aba

export function searchView() {
  let q = memo.q;
  let type = memo.type;
  let token = 0;
  let timer = 0;
  const unsubs = [];

  const input = h('input', {
    class: 'search-input',
    type: 'search',
    inputmode: 'search',
    enterkeyhint: 'search',
    placeholder: 'Buscar músicas, artistas, álbuns...',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    value: q,
    'aria-label': 'Buscar',
  });
  const clearBtn = h('button', { class: 'icon-btn search-clear', 'aria-label': 'Limpar busca', onclick: () => { input.value = ''; onInput(); input.focus(); } }, icon('close', 18));
  const field = h('div', { class: 'searchfield' }, icon('search', 20), input, clearBtn);

  const tabs = h('div', { class: 'chips', role: 'tablist' },
    TABS.map(([id, label]) =>
      h('button', { class: 'chip', role: 'tab', dataset: { type: id }, onclick: () => setType(id) }, label),
    ),
  );
  const body = h('div', { class: 'search-body' });

  const el = h('div', { class: 'view-inner search' },
    h('div', { class: 'search-sticky' }, field, tabs),
    body,
  );

  function setType(t) {
    type = t;
    memo.type = t;
    syncChips();
    run();
  }
  function syncChips() {
    tabs.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c.dataset.type === type));
    const active = tabs.querySelector('.chip.is-active');
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  function onInput() {
    q = input.value.trim();
    memo.q = q;
    el.classList.toggle('has-query', !!q);
    clearTimeout(timer);
    timer = setTimeout(run, q ? 280 : 0);
  }
  input.addEventListener('input', onInput);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      input.blur();
      remember(q);
    }
  });

  function remember(term) {
    if (!term) return;
    const list = [term, ...storage.get('recent-searches', []).filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(0, 8);
    storage.set('recent-searches', list);
  }

  const label = { track: 'Música', album: 'Álbum', artist: 'Artista', playlist: 'Playlist' };

  function interleave(res) {
    const lists = [res.tracks, res.albums, res.artists, res.playlists].map((l) => l.slice());
    const out = [];
    while (lists.some((l) => l.length)) {
      for (const l of lists) l.length && out.push(l.shift());
    }
    return out;
  }

  async function run() {
    const my = ++token;
    unsubs.forEach((u) => u());
    unsubs.length = 0;
    if (!q) return renderIdle();
    clear(body).append(skeletonRows(6));
    try {
      const res = await music.search(q, type);
      if (my !== token) return;
      renderResults(res);
    } catch (err) {
      if (my !== token) return;
      console.error(err);
      clear(body).append(emptyState({ title: 'Falha na busca', text: 'Tente novamente em instantes.' }));
    }
  }

  function renderResults(res) {
    clear(body);
    const items = type === 'all' ? interleave(res) : res[type] || [];
    if (!items.length) {
      body.append(emptyState({ title: `Nada encontrado para “${q}”`, text: 'Confira a ortografia ou tente outro termo.' }));
      return;
    }
    const tracks = items.filter((i) => i.kind === 'track');
    const list = h('div', { class: 'list' });
    items.forEach((it, i) => {
      if (it.kind === 'track') {
        list.append(trackRow(it, {
          index: i,
          subtitle: `Música · ${it.artist}`,
          onPlay: () => { remember(q); player.playTracks(tracks, tracks.indexOf(it), `Busca: ${q}`); },
        }));
      } else {
        list.append(collectionRow(it, {
          index: i,
          subtitle: it.kind === 'artist' ? 'Artista' : `${label[it.kind]} · ${it.subtitle || ''}`.replace(/ · $/, ''),
          onOpen: (x) => { remember(q); navigate(`/c/${x.kind}/${x.id}`); },
        }));
      }
    });
    body.append(list);
    unsubs.push(bindNowPlaying(body));
  }

  async function renderIdle() {
    clear(body);
    const recent = storage.get('recent-searches', []);
    if (recent.length) {
      const chips = h('div', { class: 'recent-list' },
        recent.map((term, i) =>
          h('div', { class: 'recent', style: { '--i': i } },
            h('button', { class: 'recent-main', onclick: () => { input.value = term; onInput(); } }, icon('clock', 18), h('span', {}, term)),
            h('button', { class: 'icon-btn', 'aria-label': `Remover ${term}`, onclick: () => { storage.set('recent-searches', recent.filter((x) => x !== term)); renderIdle(); } }, icon('close', 16)),
          ),
        ),
      );
      body.append(sectionHead('Buscas recentes', { label: 'Limpar', onClick: () => { storage.remove('recent-searches'); renderIdle(); } }), chips);
    }
    const holder = h('div', { class: 'suggest' });
    body.append(holder);
    try {
      const my = token;
      const sug = await music.getSuggestions();
      if (my !== token || !q === false) return;
      if (sug?.artists?.length) {
        holder.append(
          sectionHead('Explore por artistas'),
          h('div', { class: 'cards cards-round' },
            sug.artists.map((a, i) =>
              h('button', { class: 'card', style: { '--i': i }, onclick: () => navigate(`/c/artist/${a.id}`) },
                art(a.cover, { cls: 'card-art', round: true }),
                h('div', { class: 'card-title center' }, a.title),
              ),
            ),
          ),
        );
      }
      if (sug?.tracks?.length) {
        const list = h('div', { class: 'list' }, sug.tracks.map((t, i) => trackRow(t, { index: i, onPlay: () => player.playTracks(sug.tracks, i, 'Sugestões') })));
        holder.append(sectionHead('Em alta'), list);
        unsubs.push(bindNowPlaying(holder));
      }
    } catch {}
  }

  syncChips();
  el.classList.toggle('has-query', !!q);
  run();

  if (sessionStorage.__focusSearch) {
    delete sessionStorage.__focusSearch;
    setTimeout(() => input.focus({ preventScroll: true }), 350);
  }
  return { el, destroy: () => { unsubs.forEach((u) => u()); clearTimeout(timer); token++; } };
}
