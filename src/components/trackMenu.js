import { openSheet } from './sheet.js';
import { toast } from './toast.js';
import { navigate } from '../router.js';
import { player } from '../player/player.js';
import { ensureLikes, isLiked, toggleLike } from '../services/music.js';
import { share } from '../platform.js';
import { closeAllOverlays } from './overlays.js';

export async function openTrackMenu(track) {
  await Promise.race([ensureLikes([track]), new Promise((r) => setTimeout(r, 250))]);
  const liked = isLiked(track.id);
  const artist = track.artists?.[0];

  openSheet({
    title: track.title,
    subtitle: track.artist,
    cover: track.cover,
    items: [
      { icon: 'plus', label: 'Adicionar à fila', onClick: () => (player.enqueue(track), toast('Adicionada à fila')) },
      {
        icon: liked ? 'heart-fill' : 'heart',
        label: liked ? 'Remover das curtidas' : 'Curtir',
        onClick: () =>
          toggleLike(track).then(
            (v) => toast(v ? 'Adicionada às curtidas' : 'Removida das curtidas'),
            () => toast('Não foi possível atualizar'),
          ),
      },
      track.albumId && { icon: 'disc', label: 'Ver álbum', onClick: () => go(`/c/album/${track.albumId}`) },
      artist?.id && { icon: 'user', label: 'Ver artista', onClick: () => go(`/c/artist/${artist.id}`) },
      {
        icon: 'share',
        label: 'Compartilhar',
        onClick: async () => {
          const url = track.url || (track.uri?.startsWith('spotify:') ? `https://open.spotify.com/track/${track.id}` : location.href);
          const r = await share({ title: track.title, text: `${track.title} — ${track.artist}`, url });
          if (r === 'copied') toast('Link copiado');
        },
      },
    ].filter(Boolean),
  });
}

function go(path) {
  closeAllOverlays();
  navigate(path);
}
