# Armazenamento local e APIs

Como o InSound guarda dados no navegador e como ele conversa com os dois provedores de música (**Spotify** e **Audius**). Não existe backend próprio: tudo roda no navegador.

- [1. Armazenamento local](#1-armazenamento-local)
- [2. Arquitetura de provedores](#2-arquitetura-de-provedores)
- [3. Spotify](#3-spotify)
- [4. Audius](#4-audius)
- [5. Cache, erros e limites](#5-cache-erros-e-limites)
- [6. Como adicionar um novo provedor](#6-como-adicionar-um-novo-provedor)

---

## 1. Armazenamento local

Tudo é guardado no **`localStorage`** do navegador, como JSON, com o prefixo `insound:`. O acesso passa por um único módulo (`src/lib/store.js`, objeto `storage`), que envolve cada leitura e escrita em `try/catch`, para o app não quebrar quando o navegador nega o acesso (modo privado, dados do site bloqueados). Mas **o armazenamento não é opcional para tudo**:

| Fonte | Com o `localStorage` bloqueado ou indisponível |
|---|---|
| **Audius** e **Demo** | Abrem e tocam normalmente, mas **não lembram nada**: a fonte, o tema, o volume, as curtidas e o histórico se perdem ao recarregar, e o app volta para a tela de login. |
| **Spotify** | **O login não funciona.** O `code_verifier` e o `state` do PKCE precisam sobreviver ao redirecionamento para o Spotify; sem eles o retorno falha com "Falha de segurança no login (state inválido)". Os tokens também não seriam guardados. |

Em modo privado, alguns navegadores guardam os dados só até fechar a janela; nesse caso o Spotify funciona, mas a sessão some ao fechá-la.

```js
import { storage } from './lib/store.js';
storage.set('volume', 0.8);        // grava "insound:volume"
storage.get('volume', 0.8);       // lê, com valor padrão
storage.remove('volume');         // apaga
```

### Chaves usadas

| Chave | Conteúdo | Quem usa |
|---|---|---|
| `insound:mode` | `"spotify"`, `"audius"` ou `"demo"`: a fonte escolhida | todos |
| `insound:theme` | `"dark"`, `"light"` ou `"auto"` | interface |
| `insound:ambient` | `true`/`false`: brilho ambiente no player | interface |
| `insound:volume` | número de 0 a 1 | player |
| `insound:recent-searches` | lista de até 8 termos buscados | busca |
| `insound:history` | até 50 faixas tocadas, da mais recente para a mais antiga | Audius |
| `insound:audius:liked` | faixas curtidas, **objetos inteiros** (até 500) | Audius |
| `insound:demo:liked` | **IDs** das faixas curtidas | demo |
| `insound:tokens` | `{ access, refresh, expiresAt }` | Spotify |
| `insound:pkce` | `{ verifier, state, at }`: só durante o login, apagado ao voltar | Spotify |
| `insound:login-error` | texto do aviso mostrado na tela de login (ex.: acesso revogado); lido e apagado ao abrir | Spotify |

Também há dois usos de **`sessionStorage`** (somem ao fechar a aba): `insound:skip-splash` (pula a abertura depois de trocar de fonte) e `__focusSearch` (foca o campo de busca ao vir da tela inicial).

### O que isso significa

- **Não há sincronização.** O que você curte num navegador não aparece em outro nem no celular. Limpar os dados do site apaga tudo.
- **Curtidas e histórico do Audius ficam só aqui**, porque o Audius é usado sem conta. No **Spotify** as curtidas ficam **na sua conta Spotify** (o app só lê e escreve via API).
- **Segurança dos tokens.** Os tokens do Spotify ficam em texto no `localStorage`. É aceitável para um projeto acadêmico, mas **qualquer script rodando na mesma página consegue lê-los**; por isso o app não carrega scripts de terceiros além do SDK oficial do Spotify. No app nativo (Capacitor) o ideal é trocar por armazenamento seguro (Keychain/Keystore).
- **Sair** (`Configurações → Sair`) apaga `tokens`, `pkce` e `mode`; as demais preferências ficam. O mesmo acontece automaticamente quando o acesso é revogado (veja a seção 3, "Sessão e revogação de acesso").

---

## 2. Arquitetura de provedores

A interface nunca fala direto com o Spotify ou com o Audius. Ela fala com uma fachada (`src/services/music.js`), que delega ao **provider** ativo. A reprodução fica num **engine**, separado.

```
Telas ──▶ music.js (fachada + cache) ──▶ provider (dados)
Telas ──▶ player.js (fila, shuffle, repeat) ──▶ engine (reprodução)
```

### Interface de um provider

| Método | Retorna |
|---|---|
| `getUser()` | `{ id, name, image, product }` |
| `getHome()` | `{ top, recents, topTitle?, recentsTitle? }` |
| `search(q, type)` | `{ tracks, albums, artists, playlists }` (`type`: `all`, `tracks`, `albums`, `artists`, `playlists`) |
| `getSuggestions()` | `{ artists, tracks }` |
| `getLibrary()` | `{ playlists, liked, recents, albums, artists }` |
| `getCollection(kind, id)` | uma playlist/álbum/artista com `tracks[]`. `kind`: `playlist`, `album`, `artist`, `liked` |
| `isLiked(ids)` / `setLiked(track, bool)` | curtidas |

### Modelo de faixa (igual para todos os provedores)

```js
{
  id, uri, kind: 'track', title,
  artist,                      // texto: "Artista 1, Artista 2"
  artists: [{ id, name }],
  album, albumId,
  cover, coverLarge,           // URLs de imagem
  duration,                    // milissegundos
  url,                         // link público (compartilhar)
  streamUrl,                   // só Audius: URL do áudio
}
```

### Engines

| Engine | Arquivo | Como toca |
|---|---|---|
| Spotify | `src/spotify/engine.js` | Web Playback SDK (exige Premium) |
| Audius | `src/player/audioEngine.js` | `<audio>` com `track.streamUrl` |
| Demo | `src/player/demoEngine.js` | relógio simulado, sem som |

Um engine toca **uma faixa por vez**. Fila, shuffle e repeat vivem em `src/player/player.js` e valem para qualquer engine. Interface: `load(track, {autoplay})`, `play()`, `pause()`, `seek(ms)`, `setVolume(v)`, `getPosition()` e os eventos `ended`, `error`, `state`, `external`.

---

## 3. Spotify

### Configuração

1. Crie o app em <https://developer.spotify.com/dashboard> marcando **Web API** e **Web Playback SDK**.
2. Cadastre os **Redirect URIs** (devem ser idênticos, caractere por caractere, aos do app e **precisam ser salvos** com *Save*):
   - desenvolvimento: `http://127.0.0.1:5173/` (o Spotify **não aceita `localhost`**)
   - produção: `https://insound-app.vercel.app/`
3. No `.env`: `VITE_SPOTIFY_CLIENT_ID` e `VITE_SPOTIFY_REDIRECT_URI`. Em produção, defina as mesmas variáveis na Vercel e faça um novo deploy (elas são embutidas **no build**).

O Client ID **não é segredo** no fluxo PKCE, mas fica visível no código do navegador. O **Client Secret nunca é usado** nem deve ser colocado no projeto.

### Login (Authorization Code com PKCE)

Arquivo: `src/spotify/auth.js`.

1. `login()` gera um `code_verifier` e um `state` aleatórios, guarda em `insound:pkce` e redireciona para `https://accounts.spotify.com/authorize` com `code_challenge` (SHA-256 do verifier) e as permissões abaixo.
2. O Spotify volta para o Redirect URI com `?code=...&state=...`.
3. `handleRedirect()` confere o `state`, troca o `code` por tokens em `POST https://accounts.spotify.com/api/token` (com o `code_verifier`) e grava `insound:tokens`.
4. `getAccessToken()` devolve um token válido: se faltar menos de 60 s para expirar, renova com o `refresh_token` (uma renovação por vez, mesmo com várias chamadas simultâneas). `getAccessToken({ force: true })` renova mesmo com o token ainda válido.

### Sessão e revogação de acesso

O access token dura cerca de 1 hora, então, sozinho, ele não revela que o usuário removeu o acesso do InSound em [spotify.com/account/apps](https://www.spotify.com/account/apps/). Por isso o app **confere a sessão ativamente**:

| Quando | O que acontece |
|---|---|
| Qualquer chamada responde **401** | Renova o token uma vez e repete a chamada. Se o 401 persistir, encerra a sessão. |
| Renovação recusada com **`invalid_grant`** | Significa acesso revogado ou refresh token inválido: encerra a sessão. |
| 3 s depois de abrir o app, a cada 10 min e ao voltar para a aba (no máximo a cada 5 min) | `validateSession()` força uma renovação do token. Assim a revogação é detectada mesmo com o access token ainda válido. |

**Encerrar a sessão** (`expireSession()` em `src/spotify/auth.js`) apaga `tokens`, `pkce` e `mode`, grava o aviso em `insound:login-error` e recarrega o app, que volta à tela de login mostrando: *"Sua sessão do Spotify terminou ou o acesso foi revogado. Entre novamente."*

Falhas de rede ou erros temporários **não** derrubam a sessão: só `invalid_grant` ou um segundo 401 seguido. A detecção não é instantânea: pode levar até o próximo intervalo de verificação (no máximo 10 min com a aba aberta).

**Permissões (scopes) pedidas:** `streaming`, `user-read-email`, `user-read-private`, `user-read-playback-state`, `user-modify-playback-state`, `user-read-currently-playing`, `user-read-recently-played`, `user-top-read`, `user-library-read`, `user-library-modify`, `user-follow-read`, `playlist-read-private`, `playlist-read-collaborative`.

### Cliente da API

Arquivo: `src/spotify/api.js`. Toda chamada vai para `https://api.spotify.com/v1`, com `Authorization: Bearer <token>`. Em caso de **401**, renova o token uma vez e repete (ver "Sessão e revogação de acesso"). Em caso de **429** (limite de requisições), espera o tempo do cabeçalho `Retry-After` (até 8 s) e tenta de novo, no máximo 2 vezes. Respostas 202/204 devolvem `null`. Erros viram `SpotifyError` com `status`.

### Endpoints usados

Atenção: a API do Spotify mudou em **fevereiro de 2026**. O app já usa os endpoints novos.

| Para quê | Chamada |
|---|---|
| Perfil | `GET /me` |
| Mais ouvidas | `GET /me/top/tracks?time_range=short_term&limit=10` |
| Artistas favoritos | `GET /me/top/artists?time_range=medium_term&limit=10` |
| Recentes | `GET /me/player/recently-played?limit=30` |
| Busca | `GET /search?q=…&type=track,album,artist,playlist&limit=10` (o máximo agora é **10**) |
| Playlists do usuário | `GET /me/playlists` (paginado) |
| Músicas curtidas | `GET /me/tracks` |
| Álbuns salvos | `GET /me/albums` |
| Artistas seguidos | `GET /me/following?type=artist` |
| Playlist | `GET /playlists/{id}` e `GET /playlists/{id}/items` (antes era `/tracks`) |
| Álbum / Artista | `GET /albums/{id}`, `GET /artists/{id}` |
| Músicas do artista | `GET /search?q=artist:"Nome"&type=track` (o endpoint `top-tracks` foi removido) |
| Está curtida? | `GET /me/library/contains?uris=spotify:track:…` (até 40) |
| Curtir / descurtir | `PUT` / `DELETE /me/library?uris=spotify:track:…` |
| Tocar | `PUT /me/player/play?device_id=…` com `{ uris: [uri], position_ms }` |
| Transferir reprodução | `PUT /me/player` com `{ device_ids: [id], play: false }` |

### Reprodução

`src/spotify/engine.js` carrega `https://sdk.scdn.co/spotify-player.js`, cria um dispositivo chamado **InSound** e manda a faixa com `PUT /me/player/play`. Detalhes:

- **Premium é obrigatório** para tocar. Sem ele o SDK dispara `account_error` e o app mostra o aviso no player. O campo `product` foi removido de `/me` em 2026, então o app só descobre ao tentar tocar.
- O fim da faixa é detectado quando o SDK volta pausado em `0` com a faixa já nas "anteriores".
- Pausas feitas fora do app (outro dispositivo) chegam como evento `external`.
- Em **modo desenvolvimento**, a conta dona do app precisa ser Premium e só **5 usuários** autorizados (allowlist) podem usar. Playlists de terceiros não expõem as faixas para esses apps, então abrem vazias.

---

## 4. Audius

API pública, **sem chave e sem login**: `https://api.audius.co/v1`. Toda chamada leva `app_name=InSound`, que identifica o app (recomendado pelo Audius). Código em `src/audius/provider.js`.

### Endpoints usados

| Para quê | Chamada |
|---|---|
| Em alta | `GET /tracks/trending?time=week&limit=20` (e `time=month`) |
| Em alta underground | `GET /tracks/trending/underground?limit=6` |
| Busca de faixas | `GET /tracks/search?query=…&limit=10` |
| Busca de playlists/álbuns | `GET /playlists/search?query=…&limit=20` |
| Busca de artistas | `GET /users/search?query=…&limit=10` |
| Playlists em alta | `GET /playlists/trending?limit=30` |
| Playlist ou álbum | `GET /playlists/{id}` e `GET /playlists/{id}/tracks` |
| Artista | `GET /users/{id}` e `GET /users/{id}/tracks?limit=30` |
| **Áudio** | `GET /tracks/{id}/stream?app_name=InSound` |

O endpoint de stream responde **302** para um arquivo `audio/mpeg` (com CORS liberado). Por isso o app usa a própria URL como `src` de um `<audio>`: ela é guardada em `track.streamUrl`.

### Como o app adapta os dados

- Faixas com `is_streamable: false` ou apagadas são descartadas.
- `duration` vem em **segundos**; o app converte para milissegundos.
- Capas: `artwork['480x480']` para listas e `['1000x1000']` para o player.
- Álbum é uma playlist com `is_album: true`.
- **Biblioteca, curtidas e recentes são locais** (ver seção 1): o Audius não tem conta aqui. "Playlists" e "Álbuns" da biblioteca mostram o que está em alta.
- Se uma faixa não carregar, o player mostra o erro e **pula sozinho para a próxima** (até 3 vezes seguidas).

### Cuidados

- O catálogo é de **artistas independentes**: não tem os hits das paradas (covers e remixes aparecem, as gravações oficiais não).
- Não foi feita uma leitura completa dos termos de uso da API do Audius. Confira-os antes de qualquer uso além do acadêmico.

---

## 5. Cache, erros e limites

- **Cache de dados:** `music.js` guarda cada resposta por **60 segundos** (home, biblioteca, sugestões, coleções), para voltar entre abas sem recarregar. Buscas não são cacheadas. Trocar de fonte limpa o cache.
- **Curtidas otimistas:** ao curtir, a interface muda na hora; se a chamada falhar, volta ao estado anterior e avisa.
- **Estados de erro:** as telas mostram "Não foi possível carregar" com botão de tentar de novo. Falhas parciais (por exemplo, só os álbuns) não derrubam a biblioteca inteira.
- **Limites:**

| Provedor | Limite relevante |
|---|---|
| Spotify (modo desenvolvimento) | 5 usuários autorizados; dono precisa de Premium; busca com no máximo 10 resultados |
| Spotify | `429` com `Retry-After` quando passa da cota |
| Spotify | acesso revogado é detectado em até ~10 min (verificação periódica) |
| Audius | sem chave; sem limite publicado que o app dependa |

---

## 6. Como adicionar um novo provedor

1. Crie `src/<nome>/provider.js` com os métodos da seção 2, devolvendo faixas no modelo da seção 2.
2. Escolha o engine: se a fonte entrega um link de áudio, **reuse** o `audioEngine` (basta preencher `track.streamUrl`); senão, escreva um engine com a interface da seção 2.
3. Registre o modo em `src/app.js` (`setProvider(...)` + `setEngine(...)`), em `src/views/login.js` (botão de entrada) e em `src/views/settings.js` (seletor de fonte).
4. Respeite os termos de uso da fonte: o InSound **não** extrai áudio de serviços que não permitem (como o YouTube).
