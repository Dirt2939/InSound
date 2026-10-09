# InSound

> Sua música, do seu jeito.

Player de música mobile-first em **HTML, CSS e JavaScript puro** (com Vite), preparado para virar app nativo com **Capacitor**. Interface monocromática, capas coloridas, animações discretas e uma barra de progresso em forma de waveform inspirada na logo.

**App:** https://insound-app.vercel.app · **Página institucional:** https://insound-app.vercel.app/site/

## Fontes de música

O app escolhe a fonte na tela de login (e pode trocar em Biblioteca → perfil → Configurações).

| Fonte | Precisa de | Catálogo | Observações |
|---|---|---|---|
| **Audius** (grátis) | nada | artistas independentes | `<audio>` comum: toca em segundo plano e mostra controles na tela de bloqueio. **Não tem as músicas famosas.** |
| **Spotify** | Spotify Premium + Client ID | catálogo completo | Toca via Web Playback SDK. Veja os limites abaixo. |
| **Demo** | nada | dados de exemplo | Sem áudio. Serve para ver a interface. |

### Limites do Spotify (importante)

- A conta dona do app em **modo desenvolvimento precisa ser Premium**, e só **5 usuários** podem ser autorizados (allowlist no dashboard).
- Tocar dentro do app exige Premium (Web Playback SDK). Contas free conseguem navegar, mas não ouvir.
- A API mudou em 2026: o InSound já usa `/me/library` e `/playlists/{id}/items`. Playlists de terceiros não expõem as faixas para apps em modo desenvolvimento, então abrem vazias.
- O SDK **não foi validado em WebView** (Capacitor). No iOS é improvável que funcione. Veja "Capacitor" abaixo.

### Sobre o YouTube

O InSound **não** usa o YouTube como fonte. Os termos do YouTube proíbem baixar ou extrair o áudio, separá-lo do vídeo e tocar em segundo plano fora do player oficial.

## Rodando localmente

Requisitos: Node 18+.

```bash
npm install
cp .env.example .env     # só é necessário para o modo Spotify
npm run dev              # abra http://127.0.0.1:5173  (não use "localhost")
```

Para o Spotify:

1. Crie um app em <https://developer.spotify.com/dashboard> marcando **Web API** e **Web Playback SDK**.
2. Cadastre o Redirect URI `http://127.0.0.1:5173/` (idêntico ao do `.env`; o Spotify não aceita `localhost`).
3. Preencha `VITE_SPOTIFY_CLIENT_ID` no `.env` e reinicie o `npm run dev`.

> O Client ID **não é segredo** no fluxo PKCE, mas ele fica visível no bundle do navegador. O **Client Secret nunca** entra no app.

Scripts: `npm run dev`, `npm run build`, `npm run preview`.

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `VITE_SPOTIFY_CLIENT_ID` | Client ID do app no dashboard do Spotify. |
| `VITE_SPOTIFY_REDIRECT_URI` | Deve ser igual ao Redirect URI cadastrado. Padrão: `<origem>/`. |

Em produção (Vercel) as variáveis `VITE_*` são embutidas **no build**: depois de alterá-las, faça um novo deploy.

## Arquitetura

```
src/
├─ app.js, main.js, router.js     # boot, rotas por hash (funciona em WebView)
├─ player/                        # estado do player (fila, shuffle, repeat) + engines
│  ├─ player.js                   # a "verdade" do player; independente do engine
│  ├─ audioEngine.js              # <audio> (Audius)
│  ├─ demoEngine.js               # relógio simulado
│  └─ mediaSession.js             # controles de tela de bloqueio / teclas de mídia
├─ spotify/                       # auth PKCE, cliente da API, provider, Web Playback engine
├─ audius/provider.js             # API pública do Audius
├─ data/                          # provider demo + capas geradas
├─ services/                      # sessão/tema, fachada de dados (music.js), histórico
├─ components/                    # mini-player, pílula, sheets, waveform, tabbar...
├─ views/                         # início, busca, biblioteca, coleção, player, fila...
└─ styles/                        # tokens, base, componentes, telas
```

Cada fonte é um **provider** (dados) + um **engine** (reprodução) com a mesma interface, então a UI não sabe de onde vem a música.

### Destaques de interface

- **Waveform** como barra de progresso (barras orgânicas, eco da logo), com seek por arrasto.
- **Capa que voa** do mini-player para o player (View Transitions API; com fallback em CSS).
- **Pílula-notificação** que expande e recolhe ao trocar de música ou pausar.
- **Brilho ambiente** sutil com a cor da capa (opcional).
- Tema escuro, claro e automático; respeita `prefers-reduced-motion`.

## Capacitor (app nativo)

O projeto já tem `capacitor.config.json` (`appId: com.insound.app`, `webDir: dist`) e a camada `src/platform.js` como ponto único para plugins nativos. Ainda **não** foram adicionadas as plataformas.

```bash
npm run build
npx cap add android      # exige Android Studio / SDK
npx cap sync
```

Pendências conhecidas para o app nativo:

- **Audius** deve funcionar como está (é um `<audio>` comum).
- **Spotify**: o redirect do login precisa de um esquema próprio (ex.: `insound://callback`) e do tratamento do retorno; os tokens (hoje no `localStorage`) devem ir para armazenamento seguro. O Web Playback SDK pode não funcionar em WebView; o caminho alternativo é controlar o app oficial via Spotify Connect ou o App Remote SDK nativo (ambos exigem Premium).
- iOS exige Mac + Xcode e conta de desenvolvedor.
- Widgets e tela de bloqueio nativos exigem código nativo (WidgetKit / App Widgets) e não fazem parte do escopo web.

## Deploy (Vercel)

É um site estático do Vite (build: `npm run build`, saída: `dist`). O roteamento é por hash, então não precisa de rewrites.

Para o login do Spotify funcionar em produção:

1. Defina `VITE_SPOTIFY_CLIENT_ID` e `VITE_SPOTIFY_REDIRECT_URI=https://insound.vercel.app/` nas variáveis de ambiente do projeto na Vercel e refaça o deploy.
2. Cadastre `https://insound.vercel.app/` nos Redirect URIs do app no dashboard do Spotify.

## Contexto

Projeto acadêmico, sem fins comerciais (veja a licença abaixo). O Web Playback SDK do Spotify não pode ser usado em projetos comerciais sem aprovação por escrito. Os dados do Audius vêm da API pública deles; confira os termos antes de publicar com outros fins.

## Licença

[PolyForm Noncommercial 1.0.0](LICENSE): o código-fonte está disponível e pode ser usado, estudado e modificado para **fins não comerciais** (pessoal, estudo, pesquisa, educação). **Uso comercial não é permitido** sem autorização do autor. Não é uma licença "open source" no sentido da OSI.

As versões anteriores deste repositório foram publicadas sob a licença MIT; quem as obteve naquele período continua com os direitos daquela licença sobre essas versões.
