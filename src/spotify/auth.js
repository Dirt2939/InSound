/**
 * Autenticação Spotify — Authorization Code com PKCE (sem Client Secret).
 * Tokens ficam no localStorage. No app nativo (Capacitor) trocar por armazenamento seguro.
 */
import { storage } from '../lib/store.js';

export const CLIENT_ID = (import.meta.env.VITE_SPOTIFY_CLIENT_ID || '').trim();
export const REDIRECT_URI = (import.meta.env.VITE_SPOTIFY_REDIRECT_URI || `${location.origin}/`).trim();

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-recently-played',
  'user-top-read',
  'user-library-read',
  'user-library-modify',
  'user-follow-read',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

export const isConfigured = () => CLIENT_ID.length > 0;

/* ───────── PKCE helpers ───────── */
const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function randomString(len = 64) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return b64url(bytes).slice(0, len);
}

async function challengeFor(verifier) {
  return b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
}

/* ───────── login ───────── */
export async function login() {
  if (!isConfigured()) throw new Error('VITE_SPOTIFY_CLIENT_ID não configurado no .env');
  const verifier = randomString(96);
  const state = randomString(24);
  storage.set('pkce', { verifier, state, at: Date.now() });
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: await challengeFor(verifier),
    state,
    scope: SCOPES,
  });
  location.assign(url.toString());
}

/** Se a URL atual é o retorno do Spotify, troca o code por tokens. */
export async function handleRedirect() {
  const params = new URLSearchParams(location.search);
  if (!params.has('code') && !params.has('error')) return null;

  const clean = () => history.replaceState(null, '', location.pathname + (location.hash || '#/home'));
  const pkce = storage.get('pkce');
  storage.remove('pkce');

  if (params.get('error')) {
    clean();
    return { ok: false, error: params.get('error') === 'access_denied' ? 'Acesso negado no Spotify.' : params.get('error') };
  }
  if (!pkce || pkce.state !== params.get('state')) {
    clean();
    return { ok: false, error: 'Falha de segurança no login (state inválido). Tente novamente.' };
  }
  try {
    const tokens = await requestToken({
      grant_type: 'authorization_code',
      code: params.get('code'),
      redirect_uri: REDIRECT_URI,
      code_verifier: pkce.verifier,
    });
    saveTokens(tokens);
    clean();
    return { ok: true };
  } catch (err) {
    clean();
    return { ok: false, error: err.message };
  }
}

/* ───────── tokens ───────── */
async function requestToken(body) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(json.error_description || json.error || `Erro ${res.status} ao autenticar`);
    e.code = json.error;
    throw e;
  }
  return json;
}

function saveTokens(t) {
  const prev = storage.get('tokens') || {};
  storage.set('tokens', {
    access: t.access_token,
    refresh: t.refresh_token || prev.refresh,
    expiresAt: Date.now() + (t.expires_in - 60) * 1000,
  });
}

export const hasSession = () => !!storage.get('tokens')?.refresh;

let refreshing = null;
/** Retorna um access token válido (renova quando perto de expirar). */
export async function getAccessToken() {
  const t = storage.get('tokens');
  if (!t) return null;
  if (Date.now() < t.expiresAt) return t.access;
  if (!t.refresh) return null;
  refreshing ||= requestToken({ grant_type: 'refresh_token', refresh_token: t.refresh })
    .then((r) => (saveTokens(r), storage.get('tokens').access))
    .catch((err) => {
      if (err.code === 'invalid_grant') storage.remove('tokens'); // refresh revogado/expirado
      throw err;
    })
    .finally(() => (refreshing = null));
  return refreshing;
}

export function logoutLocal() {
  storage.remove('tokens');
  storage.remove('pkce');
}
