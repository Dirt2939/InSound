// Mini hyperscript: h('div', { class: 'x', onclick }, 'texto', outroNo)
// Usa textContent/appendChild — nunca innerHTML com dados externos.
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv);
          else el.style[sk] = sv;
        }
      } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Executa `fn` dentro de uma View Transition quando suportado. */
export function transition(fn, { name } = {}) {
  if (document.startViewTransition && !reducedMotion()) {
    if (name) document.documentElement.dataset.vt = name;
    const t = document.startViewTransition(fn);
    t.finished.finally(() => delete document.documentElement.dataset.vt);
    return t.finished;
  }
  fn();
  return Promise.resolve();
}
