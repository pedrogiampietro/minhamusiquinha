import * as store from "./store.js";

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
} = process.env;

const basicAuth =
  "Basic " +
  Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");

export async function exchangeCode(code, redirectUri) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: basicAuth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error("exchangeCode: " + (await res.text()));
  const d = await res.json();
  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: Date.now() + d.expires_in * 1000,
  };
}

async function refresh(id, tokens) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: basicAuth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
    }),
  });
  if (!res.ok) throw new Error("refresh: " + (await res.text()));
  const d = await res.json();
  const updated = {
    ...tokens,
    access_token: d.access_token,
    expires_at: Date.now() + d.expires_in * 1000,
    refresh_token: d.refresh_token || tokens.refresh_token,
  };
  store.updateTokens(id, updated);
  return updated;
}

export async function getValidToken(id) {
  const d = store.read(id);
  if (!d) return null;
  let tokens = d.tokens;
  if (Date.now() > tokens.expires_at - 60000) {
    tokens = await refresh(id, tokens);
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

// Devolve objeto normalizado do "tocando agora" (ou {is_playing:false})
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
