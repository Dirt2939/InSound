import { h, sleep } from '../lib/dom.js';
import { logo } from '../components/logo.js';

/** Splash: as 5 barras da logo "acendem" em sequência, com a barra de carregamento embaixo. */
export function showSplash(parent, { duration = 1700 } = {}) {
  const el = h('div', { class: 'splash', role: 'presentation' },
    h('div', { class: 'splash-center' },
      logo({ size: 92, className: 'splash-logo' }),
      h('div', { class: 'splash-name' }, 'InSound'),
      h('div', { class: 'splash-tag' }, 'Sua música,', h('br'), 'do seu jeito.'),
    ),
    h('div', { class: 'splash-load' }, h('i')),
  );
  parent.append(el);
  return {
    el,
    done: sleep(duration),
    async hide() {
      el.classList.add('is-leaving');
      await sleep(520);
      el.remove();
    },
  };
}
