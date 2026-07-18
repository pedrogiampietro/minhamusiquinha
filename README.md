# Spotify Now Playing Widget + Painel

Widget de "tocando agora" do Spotify para OBS (estilo 6K Labs / Amuse), agora
com um **painel de controle** para conectar contas, ajustar o widget ao vivo,
copiar a URL, remover conexões e acompanhar métricas de reprodução.

## O que tem

- **Widget** (`/widget/:id`) — a página que vai no OBS. Capa, título, artista,
  tempo, barra de progresso animada e ponto de status.
- **Painel** (`/`) — gerencia tudo:
  - Lista de contas conectadas (com avatar e plano premium/free)
  - **Preview ao vivo** do widget dentro do painel
  - **Ajustes** que salvam sozinhos: nº de barras, intervalo de atualização,
    raio dos cantos, cor de destaque, cores de fundo/cartão, mostrar álbum,
    rolar título longo, ocultar quando pausado
  - **URL para o OBS** com botões de copiar e remover
  - **Métricas:** plays hoje/semana, artistas únicos, tempo tocado,
    top artistas, top faixas e histórico de tocadas recentemente
- **Poller de fundo** — o servidor amostra cada conta a cada 30s, então as
  métricas são coletadas mesmo com o widget fechado no OBS.

## Arquitetura

```
server.js              rotas HTTP (OAuth, API do widget, API do painel)
lib/store.js           persistência: tokens, config e histórico por conexão
lib/spotify.js         integração com a API do Spotify
lib/poller.js          amostragem periódica para as métricas
public/dashboard.html  o painel
public/widget.html     o widget do OBS
data/                  um JSON por conexão (não versionar)
```

Cada conexão tem um `:id` aleatório de 24 bytes que funciona como chave da URL.

## 1. Criar o app no Spotify

1. https://developer.spotify.com/dashboard -> crie um app.
2. Em **Redirect URIs**, adicione exatamente:
   - Local: `http://127.0.0.1:8888/callback`
   - Producao: `https://seu-dominio.com/callback`
3. Copie **Client ID** e **Client Secret**.

> O Spotify nao aceita mais `localhost` — use `127.0.0.1`.

## 2. Configurar e rodar

```bash
npm install
cp .env.example .env      # preencha CLIENT_ID, CLIENT_SECRET, BASE_URL
npm start
```

Abra `http://127.0.0.1:8888`, clique em **+ Conectar Spotify**, autorize.
Voce volta pro painel ja com a conexao selecionada.

## 3. No OBS

- **Fontes -> + -> Navegador (Browser)**
- Cole a URL do widget (botao **Copiar** no painel)
- Largura **680**, Altura **200**
- Marque **"Atualizar quando a cena ficar ativa"**

Qualquer ajuste no painel reflete no widget na proxima atualizacao — nao precisa
recriar a fonte no OBS.

## Ajustes rapidos por URL (opcional)

A querystring sobrepoe a config salva, util pra testar:
`.../widget/SEU_ID?bars=30&poll=2000&accent=8b5cf6`

## Colocar online

Hospede em qualquer servico Node (Railway, Render, Fly.io, VPS), ajuste
`BASE_URL` no `.env` e adicione o `/callback` de producao nos Redirect URIs.
Para persistencia entre deploys, monte um volume na pasta `data/`.

## Seguranca

- Tokens ficam em `data/*.json` no servidor, nunca vao pro browser/OBS.
- O `:id` do widget e aleatorio e funciona como chave: quem tem a URL ve o que
  voce ouve, mas **nao** acessa sua conta.
- Escopos pedidos: apenas leitura da reproducao.
- O painel nao tem senha — se for hospedar publicamente, coloque atras de um
  proxy com auth (ex: basic auth no nginx) ou allowlist de IP.
