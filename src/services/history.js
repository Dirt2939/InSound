import { storage } from '../lib/store.js';
import { playerStore } from '../player/player.js';

/** Histórico local de reprodução (usado pelo modo Audius, que não tem conta). */
const KEY = 'history';
const MAX = 50;

export const getHistory = () => storage.get(KEY, []);

export function addToHistory(track) {
  const { queued, ...clean } = track;
  void queued;
  const list = [clean, ...getHistory().filter((t) => t.id !== track.id)].slice(0, MAX);
  storage.set(KEY, list);
}

export function initHistory() {
  let lastAt = 0;
  playerStore.subscribe((s) => {
    if (s.event?.type !== 'track' || s.event.at === lastAt || !s.track) return;
    lastAt = s.event.at;
    addToHistory(s.track);
  });
}
