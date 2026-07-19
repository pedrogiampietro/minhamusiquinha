# Deploy na Vercel

## 1. Corrigir o "No entrypoint found"

A Vercel não estava detectando o Next.js (preset em "Other"), então procurava um
`server.js` e falhava. O arquivo **`vercel.json`** força o framework:

```json
{ "framework": "nextjs" }
```

Faça commit e push:

```bash
git add vercel.json
git commit -m "fix: forçar framework nextjs na Vercel"
git push
```

> Alternativa pelo painel: Project → Settings → General → **Framework Preset →
> Next.js**. O `vercel.json` já resolve sem depender disso.

## 2. Variáveis de ambiente (OBRIGATÓRIO antes de re-deployar)

O `.env.local` **não** vai no Git. Sem estas variáveis, o `next build` falha na
Vercel (a chave do Clerk é lida no build). Em **Project → Settings →
Environment Variables**, adicione em **Production** (e Preview, se quiser):

| Variável | Valor |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` (sua chave) |
| `CLERK_SECRET_KEY` | `sk_test_...` (sua chave) |
| `DATABASE_URL` | connection string do Neon (a mesma do `.env.local`) |
| `SPOTIFY_CLIENT_ID` | opcional — fallback do app da sua conta |
| `SPOTIFY_CLIENT_SECRET` | opcional — fallback do app da sua conta |
| `BASE_URL` | a URL de produção, ex. `https://minhamusiquinha.vercel.app` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/` |

Depois de salvar, faça **Redeploy** (a Vercel não reusa env de builds antigos).

## 3. Spotify: redirect URI de produção

No [Spotify Dashboard](https://developer.spotify.com/dashboard) → seu app →
Settings → Redirect URIs, adicione a URL de produção (além da local):

```
https://minhamusiquinha.vercel.app/api/spotify/callback
```

Tem que bater **exatamente** com `${BASE_URL}/api/spotify/callback`. Use um
domínio de produção estável (não os domínios aleatórios de cada deploy).

## 4. Banco de dados

O Neon é o mesmo banco que você já usa localmente — as tabelas já foram criadas
com `npm run db:migrate`. **Não precisa migrar de novo** para a Vercel.

## 5. Clerk em produção (opcional, mas recomendado)

As chaves `pk_test`/`sk_test` são do ambiente de desenvolvimento do Clerk.
Funcionam para testar, mas para produção de verdade crie uma **Production
instance** no Clerk, aponte para o domínio da Vercel e troque as chaves por
`pk_live_`/`sk_live_`.

## Checklist rápido

1. `git push` com o `vercel.json`.
2. Variáveis de ambiente configuradas na Vercel (Production).
3. `BASE_URL` = domínio de produção.
4. Redirect URI de produção cadastrado no Spotify.
5. Redeploy.
