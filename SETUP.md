# Setup — Spotify Widget (Next.js + Neon + Clerk)

O app foi reconstruído de Express + HTML para **Next.js (App Router)** com
**Neon Postgres** e **autenticação Clerk**. Rode estes passos **na sua máquina
Windows** (o ambiente onde ele roda de verdade).

## 0. Pré-requisitos

- Node 18+ (você já tem o 22)
- A pasta antiga (Express) foi preservada em `legacy/` — nada foi perdido.

## 1. Instalar dependências

```bash
npm install
```

> As dependências antigas foram removidas; isto instala Next, React, Clerk e o
> driver do Neon do zero.

## 2. Configurar o Clerk

O jeito mais simples é usar o CLI, que preenche as chaves no `.env.local`:

```bash
npm install -g clerk
clerk auth login
clerk init --app app_3GhEcjfAWB8TZCdVWse73AsglbS
```

Se preferir manual: abra <https://dashboard.clerk.com> → **API Keys** e copie
para o `.env.local`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

> Já deixei `ClerkProvider`, middleware, páginas `/sign-in` e `/sign-up` e o
> botão de usuário prontos. Só faltam as duas chaves acima.

## 3. Criar as tabelas no Neon

```bash
npm run db:migrate
```

Isso aplica `db/schema.sql` (tabelas `connections`, `plays` e `spotify_apps`) no
banco definido em `DATABASE_URL`. É idempotente — pode rodar de novo sempre que o
schema mudar (ex.: ao adicionar a tabela `spotify_apps`).

## 4. Spotify — cada usuário cria o próprio app

O modelo é **multiusuário**: cada pessoa cria o próprio app no Spotify e informa
o Client ID/Secret no onboarding (guardados por usuário na tabela `spotify_apps`).
O app global do `.env.local` (`SPOTIFY_CLIENT_ID/SECRET`) é **opcional** e serve
só de fallback para a sua própria conta.

Fluxo do usuário (o onboarding guia isso):

1. Abrir o [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   → **Create app** (marcar **Web API**).
2. Em **Redirect URIs**, colar exatamente `${BASE_URL}/api/spotify/callback`
   (local: `http://127.0.0.1:8888/api/spotify/callback`; produção: a URL da
   Vercel). O onboarding mostra o endereço exato com botão de copiar.
3. Copiar **Client ID** e **Client Secret** e colar no wizard → **Salvar e
   conectar**.

> Vantagem: como cada um usa o próprio app (é o dono), o Development Mode do
> Spotify não limita — não precisa pedir Extended Quota nem liberar e-mails.

## 5. Rodar

```bash
npm run dev
```

Abra <http://127.0.0.1:8888> → faça login (Clerk) → **+ Conectar Spotify** →
copie a **URL do OBS** (`/widget/<id>`) e cole como Browser Source.

## Segurança

As credenciais (Spotify Secret, senha do Neon) foram compartilhadas em texto
aberto no chat. Recomendo **regenerá-las** depois que tudo estiver funcionando:
o Secret no dashboard do Spotify e a senha do role no painel do Neon.

## O que mudou (mapa rápido)

| Antes (Express)              | Agora (Next.js)                          |
| ---------------------------- | ---------------------------------------- |
| `server.js`                  | `app/` + route handlers em `app/api/*`   |
| `lib/store.js` (JSON files)  | `lib/store.js` (Neon Postgres)           |
| `public/dashboard.html`      | `app/(main)/Dashboard.jsx` (protegido)   |
| `public/widget.html`         | `app/widget/[id]/Widget.jsx` (público)   |
| `/login`, `/callback`        | `/api/spotify/login`, `/api/spotify/callback` |
| `lib/poller.js` (30s)        | removido — grava ao consultar now-playing |
| sem auth                     | Clerk protege o painel; widget fica público |
