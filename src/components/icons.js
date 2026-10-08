// Ícones 24x24. `s` = stroke (contorno 1.7px), `f` = preenchido.
const I = {
  home: { s: '<path d="M3.5 10.6 12 3.5l8.5 7.1V19.5a1 1 0 0 1-1 1H15v-6.2H9v6.2H4.5a1 1 0 0 1-1-1z"/>' },
  search: { s: '<circle cx="11" cy="11" r="6.8"/><path d="m20 20-4.1-4.1"/>' },
  library: { s: '<path d="M5 4.5v15M10 4.5v15M14.6 6.2l4.6 13.3"/>' },
  plus: { s: '<path d="M12 5v14M5 12h14"/>' },
  heart: { s: '<path d="M12 20s-7.4-4.5-7.4-10.3A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.4 2.5C19.4 15.5 12 20 12 20z"/>' },
  'heart-fill': { f: '<path d="M12 20s-7.4-4.5-7.4-10.3A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.4 2.5C19.4 15.5 12 20 12 20z"/>' },
  play: { f: '<path d="M7.5 4.8v14.4a.6.6 0 0 0 .9.5l11.7-7.2a.6.6 0 0 0 0-1L8.4 4.3a.6.6 0 0 0-.9.5z"/>' },
  pause: { f: '<rect x="6" y="4.5" width="4.2" height="15" rx="1.3"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.3"/>' },
  next: { f: '<path d="M6 5.6v12.8a.5.5 0 0 0 .8.4l8.6-6.4a.5.5 0 0 0 0-.8L6.8 5.2a.5.5 0 0 0-.8.4z"/><rect x="17" y="5" width="2.4" height="14" rx="1.2"/>' },
  prev: { f: '<path d="M18 5.6v12.8a.5.5 0 0 1-.8.4l-8.6-6.4a.5.5 0 0 1 0-.8l8.6-6.4a.5.5 0 0 1 .8.4z"/><rect x="4.6" y="5" width="2.4" height="14" rx="1.2"/>' },
  shuffle: { s: '<path d="M3 17h2.6c1.6 0 2.7-.7 3.6-2.1M3 7h2.6c1.6 0 2.7.7 3.6 2.1l2.6 5.8c.9 1.4 2 2.1 3.6 2.1H21M15 7h6M18 4l3 3-3 3M18 14l3 3-3 3"/>' },
  repeat: { s: '<path d="M17 3.5 20 6.5l-3 3M4 12V10.5a4 4 0 0 1 4-4h12M7 20.5l-3-3 3-3M20 12v1.5a4 4 0 0 1-4 4H4"/>' },
  'repeat-one': { s: '<path d="M17 3.5 20 6.5l-3 3M4 12V10.5a4 4 0 0 1 4-4h12M7 20.5l-3-3 3-3M20 12v1.5a4 4 0 0 1-4 4H4M11 10.5l1.4-.9v5.2"/>' },
  'chev-down': { s: '<path d="m6 9.5 6 6 6-6"/>' },
  'chev-left': { s: '<path d="m15 5-7 7 7 7"/>' },
  'chev-right': { s: '<path d="m9 5 7 7-7 7"/>' },
  more: { f: '<circle cx="5.5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18.5" cy="12" r="1.7"/>' },
  'more-v': { f: '<circle cx="12" cy="5.5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="18.5" r="1.7"/>' },
  close: { s: '<path d="M6 6l12 12M18 6 6 18"/>' },
  bell: { s: '<path d="M6.2 16.5v-5.3a5.8 5.8 0 0 1 11.6 0v5.3l1.7 2H4.5zM10 20.8a2.2 2.2 0 0 0 4 0"/>' },
  queue: { s: '<path d="M4 6.5h13M4 11.5h13M4 16.5h6.5"/><path d="M15.5 14.3v5.2l4.3-2.6z" fill="currentColor"/>' },
  share: { s: '<path d="M12 15.5V4M8 8l4-4 4 4M5 12.5v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>' },
  volume: { s: '<path d="M4 9.7h3.4L12 6v12l-4.6-3.7H4z"/><path d="M15.4 9.2a4 4 0 0 1 0 5.6M18 6.6a7.6 7.6 0 0 1 0 10.8"/>' },
  'volume-low': { s: '<path d="M4 9.7h3.4L12 6v12l-4.6-3.7H4z"/><path d="M15.4 9.2a4 4 0 0 1 0 5.6"/>' },
  user: { s: '<circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20c.6-3.7 3.5-5.7 7.2-5.7s6.6 2 7.2 5.7"/>' },
  disc: { s: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.4"/>' },
  clock: { s: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5M3.5 3.8v4.7H8.2M12 7.7V12l3 1.9"/>' },
  check: { s: '<path d="m5 12.5 4.6 4.5L19 7.5"/>' },
  sun: { s: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>' },
  moon: { s: '<path d="M20 14.2A8 8 0 0 1 9.8 4 8 8 0 1 0 20 14.2z"/>' },
  logout: { s: '<path d="M9 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h3M16 8l4 4-4 4M20 12H9.5"/>' },
  sparkle: { s: '<path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18l-1.8-5.4L4.5 10.8 10.2 9z"/>' },
};

export function icon(name, size = 24, extra = '') {
  const def = I[name];
  if (!def) throw new Error('ícone desconhecido: ' + name);
  const span = document.createElement('span');
  span.className = ('ico ' + extra).trim();
  span.style.width = span.style.height = size + 'px';
  const fill = def.f ? 'currentColor' : 'none';
  const stroke = def.s ? 'currentColor' : 'none';
  span.innerHTML =
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${fill}" stroke="${stroke}" ` +
    `stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${def.s || def.f}</svg>`;
  return span;
}

/** Troca o ícone dentro de um .ico existente (sem recriar o botão). */
export function setIcon(host, name, size = 24) {
  const next = icon(name, size);
  host.replaceChildren(...next.childNodes);
}

export const hasIcon = (n) => n in I;
