import { h } from '../lib/dom.js';

let host;
export function mountToasts(parent) {
  host = h('div', { class: 'toast-host', 'aria-live': 'polite' });
  parent.append(host);
}

export function toast(message, { duration = 2400 } = {}) {
  if (!host) return;
  const el = h('div', { class: 'toast' }, message);
  host.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => {
    el.classList.remove('in');
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, duration);
}
