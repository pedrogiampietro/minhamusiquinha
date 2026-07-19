import * as store from "./store.js";

// Cada usuário registra o próprio app Spotify. `app` é a linha de spotify_apps
// (client_id / client_secret); se não houver, cai no app global do .env.local.
function credsFor(app) {
  const id = app?.client_id || process.env.SPOTIFY_CLIENT_ID;
  const secret = app?.client_secret || process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "Nenhum app do Spotify configurado. Crie um app no Spotify Developer " +
        "Dashboard e informe o Client ID e o Client Secret."
    );
  }
  return {
    id,
    secret,
    basic: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
  };
}

// Transforma erros crus da API de token em mensagens acionáveis.
function tokenError(context, status, body) {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = { error: body };
  }
  if (parsed.error === "invalid_client") {
    return new Error(
      `${context}: invalid_client — o SPOTIFY_CLIENT_ID/SECRET não confere. ` +
        `Confirme os dois valores no Spotify Developer Dashboard (o Client Secret ` +
        `pode ter sido regenerado) e verifique se não há espaços no .env.local.`
    );
  }
  if (parsed.error === "invalid_grant") {
    return new Error(
      `${context}: invalid_grant — normalmente é o Redirect URI. ` +
        `Cadastre exatamente "${process.env.BASE_URL}/api/spotify/callback" no dashboard do Spotify.`
    );
  }
  return new Error(
    `${context}: ${parsed.error || "erro"} (HTTP ${status}) ${
      parsed.error_description || ""
    }`
  );
}

export async function exchangeCode(code, redirectUri, app) {
  const { basic } = credsFor(app);
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: basic,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw tokenError("exchangeCode", res.status, await res.text());
  const d = await res.json();
  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: Date.now() + d.expires_in * 1000,
  };
}

async function refresh(id, tokens, app) {
  const { basic } = credsFor(app);
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: basic,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
    }),
  });
  if (!res.ok) throw tokenError("refresh", res.status, await res.text());
  const d = await res.json();
  const updated = {
    ...tokens,
    access_token: d.access_token,
    expires_at: Date.now() + d.expires_in * 1000,
    refresh_token: d.refresh_token || tokens.refresh_token,
  };
  await store.updateTokens(id, updated);
  return updated;
}

export async function getValidToken(id) {
  const d = await store.read(id);
  if (!d) return null;
  let tokens = d.tokens;
  if (Date.now() > tokens.expires_at - 60000) {
    const app = await store.getUserApp(d.user_id);
    tokens = await refresh(id, tokens, app);
  }
  return tokens.access_token;
}

export async function fetchProfile(accessToken) {
  const r = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return null;
  const d = await r.json();
  return {
    id: d.id,
    name: d.display_name,
    image: d.images?.[0]?.url || null,
    product: d.product, // premium / free
  };
}

// Objeto normalizado do "tocando agora" (ou { is_playing:false }).
export async function fetchNowPlaying(id) {
  const token = await getValidToken(id);
  if (!token) return { error: "not_found" };

  const r = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing",
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (r.status === 204 || r.status === 202) return { is_playing: false };
  if (!r.ok) return { error: "spotify_error", status: r.status };

  const d = await r.json();
  if (!d || !d.item) return { is_playing: false };

  return {
    is_playing: d.is_playing,
    progress_ms: d.progress_ms,
    duration_ms: d.item.duration_ms,
    trackId: d.item.id,
    title: d.item.name,
    artist: d.item.artists.map((a) => a.name).join(", "),
    album: d.item.album?.name || null,
    image: d.item.album?.images?.[0]?.url || null,
  };
}
