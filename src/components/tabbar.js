import { h } from '../lib/dom.js';
import { icon } from './icons.js';
import { navigate, currentTab, onRoute } from '../router.js';
import { haptic } from '../platform.js';

const TABS = [
  { id: 'home', label: 'Início', icon: 'home', path: '/home' },
  { id: 'search', label: 'Explorar', icon: 'search', path: '/search' },
  { id: 'library', label: 'Biblioteca', icon: 'library', path: '/library' },
];

export function createTabbar() {
  const indicator = h('span', { class: 'tab-indicator' });
  const buttons = TABS.map((t) =>
    h('button', {
      class: 'tab',
      dataset: { tab: t.id },
      'aria-label': t.label,
      onclick: () => {
        haptic();
        navigate(t.path);
      },
    }, icon(t.icon, 24, 'tab-ico'), h('span', { class: 'tab-label' }, t.label)),
  );
  const el = h('nav', { class: 'tabbar' }, indicator, buttons);

  function sync() {
    const cur = currentTab();
    const i = TABS.findIndex((t) => t.id === cur);
    buttons.forEach((b, k) => b.classList.toggle('is-active', k === i));
    el.dataset.active = String(i);
    indicator.style.opacity = i === -1 ? '0' : '1';
    if (i !== -1) indicator.style.setProperty('--tab', String(i));
  }
  onRoute(sync);
  sync();
  return el;
}
