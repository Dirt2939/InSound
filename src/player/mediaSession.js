import { playerStore, player } from './player.js';

/**
 * Media Session: capa, título e controles na tela de bloqueio / central de mídia /
 * teclas multimídia (navegador e WebView). Widgets nativos ficam para a fase Capacitor.
 */
export function initMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  const set = (action, fn) => { try { ms.setActionHandler(action, fn); } catch {} };

  set('play', () => player.play());
  set('pause', () => player.pause());
  set('previoustrack', () => player.prev());
  set('nexttrack', () => player.next());
  set('seekto', (d) => d.seekTime != null && player.seek(d.seekTime * 1000));
  set('seekbackward', (d) => player.seek(Math.max(0, player.getPosition() - (d.seekOffset || 10) * 1000)));
  set('seekforward', (d) => player.seek(player.getPosition() + (d.seekOffset || 10) * 1000));

  let lastId = null;
  let lastPlaying = null;
  playerStore.subscribe((s) => {
    const t = s.track;
    if (!t) {
      ms.metadata = null;
      ms.playbackState = 'none';
      lastId = null;
      return;
    }
    if (t.id !== lastId) {
      lastId = t.id;
      const src = t.coverLarge || t.cover;
      ms.metadata = new MediaMetadata({
        title: t.title,
        artist: t.artist,
        album: t.album || '',
        artwork: src ? [{ src, sizes: '640x640' }] : [],
      });
    }
    if (s.playing !== lastPlaying || t.id !== lastId) {
      lastPlaying = s.playing;
      ms.playbackState = s.playing ? 'playing' : 'paused';
    }
    try {
      if (s.duration) ms.setPositionState({ duration: s.duration / 1000, position: Math.min(player.getPosition(), s.duration) / 1000, playbackRate: 1 });
    } catch {}
  });
}
