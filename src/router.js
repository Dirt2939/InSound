/**
 * Roteador por hash (funciona em file:// e no WebView do Capacitor).
 * Rotas: /home  /search  /library  /c/:kind/:id
 */
const listeners = new Set();
let routes = [];

export function defineRoutes(list) {
  routes = list.map(([pattern, render]) => {
    const keys = [];
    const rx = new RegExp(
      '^' + pattern.replace(/:([a-z]+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$',
    );
    return { rx, keys, render };
  });
}

export function currentPath() {
  return location.hash.replace(/^#/, '') || '/home';
}

export function match(path = currentPath()) {
  for (const r of routes) {
    const m = path.match(r.rx);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { render: r.render, params, path };
    }
  }
  return null;
}

export function navigate(path, { replace = false } = {}) {
  if (currentPath() === path) return;
  if (replace) location.replace('#' + path);
  else location.hash = '#' + path;
}

export const back = () => history.back();

export function currentTab() {
  const p = currentPath();
  if (p.startsWith('/home')) return 'home';
  if (p.startsWith('/search')) return 'search';
  if (p.startsWith('/library')) return 'library';
  return null;
}

export const onRoute = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const startRouter = () => {
  const run = () => listeners.forEach((fn) => fn(currentPath()));
  addEventListener('hashchange', run);
  run();
};
