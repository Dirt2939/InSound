import { transition } from '../lib/dom.js';

/**
 * Gerenciador de overlays (player, fila, sheets). Mantém uma pilha e integra com o
 * histórico — o botão "voltar" do Android/navegador fecha o overlay do topo.
 */
const stack = [];
const reg = new Map();
const listeners = new Set();
let skipVT = false;
let pending = [];

export function registerOverlay(name, el, { dynamic = false } = {}) {
  reg.set(name, { el, dynamic });
  el.inert = true;
}

export const isOpen = (name) => stack.includes(name);
export const topOverlay = () => stack[stack.length - 1] ?? null;
export const onOverlayChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));

function sync() {
  for (const [name, { el, dynamic }] of reg) {
    const open = stack.includes(name);
    el.classList.toggle('open', open);
    el.inert = !open;
    if (dynamic && !open) {
      reg.delete(name);
      setTimeout(() => el.remove(), 380);
    }
  }
  document.documentElement.classList.toggle('player-open', stack.includes('player'));
  listeners.forEach((fn) => fn([...stack]));
}

export function openOverlay(name, { vt = false } = {}) {
  if (stack.includes(name)) return;
  const apply = () => {
    stack.push(name);
    history.pushState({ ov: name }, '');
    sync();
  };
  vt ? transition(apply) : apply();
}

/** Fecha o overlay. A Promise resolve quando o fechamento (assíncrono via histórico) terminou. */
export function closeOverlay(name, { vt = true } = {}) {
  const i = stack.lastIndexOf(name);
  if (i === -1) return Promise.resolve();
  if (history.state?.ov === name) {
    skipVT = !vt;
    return new Promise((resolve) => {
      pending.push(resolve);
      setTimeout(resolve, 500); // rede de segurança
      history.back(); // o popstate abaixo faz o fechamento de fato
    });
  }
  stack.splice(i, 1);
  sync();
  return Promise.resolve();
}

export function closeAllOverlays() {
  if (!stack.length) return;
  stack.length = 0;
  sync();
}

addEventListener('popstate', () => {
  const want = history.state?.ov;
  const keep = want ? stack.lastIndexOf(want) + 1 : 0; // quantos overlays continuam abertos
  const closesPlayer = stack.includes('player') && !stack.slice(0, keep).includes('player');
  const vt = closesPlayer && !skipVT && topOverlay() === 'player';
  skipVT = false;
  const apply = () => {
    stack.length = keep;
    sync();
    pending.splice(0).forEach((r) => r());
  };
  vt ? transition(apply) : apply();
});
