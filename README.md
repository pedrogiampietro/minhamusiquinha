# Spotify Now Playing Widget

Widget "Now Playing" do Spotify para OBS, com painel de configuração e métricas.
Reconstruído em **Next.js (App Router)** + **Neon Postgres** + **Clerk**.

## Stack

- **Next.js 15** (App Router, route handlers)
- **Neon Postgres** via `@neondatabase/serverless` (`lib/db.js`, `lib/store.js`)
- **Clerk** para autenticação (`middleware.js`, `app/(main)/layout.js`)
- Widget e painel em React (CSS Modules)

## Rotas

| Rota                          | Auth      | Descrição                              |
| ----------------------------- | --------- | -------------------------------------- |
| `/`                           | Clerk     | Painel: conexões, ajustes, métricas    |
| `/sign-in`, `/sign-up`        | pública   | Login / cadastro (Clerk)               |
| `/widget/:id`                 | pública   | Widget para o OBS                      |
| `/api/spotify/login`          | Clerk     | Inicia o OAuth do Spotify              |
| `/api/spotify/callback`       | Clerk     | Troca o code e cria a conexão          |
| `/api/now-playing/:id`        | pública   | Tocando agora (consumido pelo widget)  |
| `/api/config/:id`             | GET pública / PUT Clerk | Config do widget          |
| `/api/connections`            | Clerk     | Lista conexões do usuário              |
| `/api/connection/:id`         | Clerk     | Detalhe / remover (dono)               |
| `/api/metrics/:id`            | Clerk     | Métricas (dono)                        |

## Como rodar

Veja **[SETUP.md](./SETUP.md)** — instalar deps, configurar Clerk, migrar o
banco, ajustar o Spotify e subir com `npm run dev`.

## Banco de dados

`db/schema.sql` define as tabelas. Aplique com:

```bash
npm run db:migrate
```

- `connections` — uma conta Spotify conectada (ligada ao usuário Clerk).
- `plays` — histórico de faixas (base das métricas).

## Legado

A versão anterior (Express + arquivos JSON) está em `legacy/` para referência.
