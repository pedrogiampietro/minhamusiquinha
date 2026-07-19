import { getSql } from "./db.js";

// Configuração padrão do widget.
export const DEFAULT_CONFIG = {
  skin: "compact", // compact | minimal | vinyl | boxy | macos
  bars: 24,
  poll: 3000,
  accent: "#1db954",
  bg: "#0d0d0d",
  card: "#171717",
  text: "#ffffff",
  font: "sans", // sans | rounded | mono | condensed
  cover: "square", // square | vinyl | none
  coverGlow: false,
  blurBg: false,
  autoColor: false,
  progressStyle: "bars", // bars | dots | line
  showAlbum: false,
  scrollTitle: true,
  cornerRadius: 26,
  hideWhenPaused: false,
};

// ---------- conexões ----------

export async function create(id, { userId, profile, tokens, config }) {
  const sql = getSql();
  const cfg = { ...DEFAULT_CONFIG, ...(config || {}) };
  const rows = await sql`
    INSERT INTO connections (id, user_id, profile, tokens, config)
    VALUES (${id}, ${userId}, ${profile}, ${tokens}, ${cfg})
    RETURNING *`;
  return rows[0];
}

export async function read(id) {
  const sql = getSql();
  const rows = await sql`SELECT * FROM connections WHERE id = ${id}`;
  return rows[0] || null;
}

// Config completa (defaults + salvos) — usada pelo widget público.
export async function readConfig(id) {
  const d = await read(id);
  if (!d) return null;
  return { ...DEFAULT_CONFIG, ...(d.config || {}) };
}

export async function updateTokens(id, tokens) {
  const sql = getSql();
  await sql`UPDATE connections SET tokens = ${tokens} WHERE id = ${id}`;
}

export async function updateConfig(id, patch) {
  const sql = getSql();
  const d = await read(id);
  if (!d) return null;
  const config = { ...DEFAULT_CONFIG, ...(d.config || {}), ...patch };
  await sql`UPDATE connections SET config = ${config} WHERE id = ${id}`;
  return config;
}

export async function remove(id) {
  const sql = getSql();
  const rows = await sql`DELETE FROM connections WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

// Lista as conexões de um usuário (com contagem de plays).
export async function listByUser(userId) {
  const sql = getSql();
  const rows = await sql`
    SELECT c.id, c.profile, c.created_at,
           COUNT(p.id)::int AS plays
    FROM connections c
    LEFT JOIN plays p ON p.connection_id = c.id
    WHERE c.user_id = ${userId}
    GROUP BY c.id
    ORDER BY c.created_at DESC`;
  return rows.map((r) => ({
    id: r.id,
    profile: r.profile,
    createdAt: new Date(r.created_at).getTime(),
    plays: r.plays,
  }));
}

// ---------- app Spotify do usuário ----------

export async function getUserApp(userId) {
  const sql = getSql();
  const rows = await sql`
    SELECT client_id, client_secret FROM spotify_apps WHERE user_id = ${userId}`;
  return rows[0] || null;
}

export async function saveUserApp(userId, clientId, clientSecret) {
  const sql = getSql();
  await sql`
    INSERT INTO spotify_apps (user_id, client_id, client_secret)
    VALUES (${userId}, ${clientId}, ${clientSecret})
    ON CONFLICT (user_id) DO UPDATE
      SET client_id = EXCLUDED.client_id,
          client_secret = EXCLUDED.client_secret,
          updated_at = now()`;
}

// ---------- histórico / métricas ----------

export async function recordPlay(id, track) {
  const sql = getSql();
  // Evita duplicar a mesma faixa em amostragens seguidas.
  const last = await sql`
    SELECT track_id FROM plays
    WHERE connection_id = ${id}
    ORDER BY played_at DESC LIMIT 1`;
  if (last[0] && last[0].track_id === track.trackId) return;

  await sql`
    INSERT INTO plays (connection_id, track_id, title, artist, album, image, duration_ms)
    VALUES (${id}, ${track.trackId}, ${track.title}, ${track.artist},
            ${track.album}, ${track.image}, ${track.duration_ms})`;
}

export async function metrics(id) {
  const sql = getSql();
  const conn = await read(id);
  if (!conn) return null;

  const rows = await sql`
    SELECT track_id, title, artist, album, image, duration_ms, played_at
    FROM plays WHERE connection_id = ${id}
    ORDER BY played_at ASC`;

  const h = rows.map((r) => ({
    trackId: r.track_id,
    title: r.title,
    artist: r.artist,
    album: r.album,
    image: r.image,
    duration_ms: r.duration_ms,
    playedAt: new Date(r.played_at).getTime(),
  }));

  const now = Date.now();
  const dayAgo = now - 24 * 3600 * 1000;
  const weekAgo = now - 7 * 24 * 3600 * 1000;

  const countBy = (arr, key) => {
    const m = new Map();
    for (const it of arr) {
      const k = it[key];
      if (!k) continue;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  };

  const listenedMs = h.reduce((s, it) => s + (it.duration_ms || 0), 0);

  return {
    totalPlays: h.length,
    playsToday: h.filter((x) => x.playedAt >= dayAgo).length,
    playsWeek: h.filter((x) => x.playedAt >= weekAgo).length,
    listenedMs,
    uniqueTracks: new Set(h.map((x) => x.trackId)).size,
    uniqueArtists: new Set(h.map((x) => x.artist)).size,
    topArtists: countBy(h, "artist").slice(0, 5),
    topTracks: countBy(
      h.map((x) => ({ t: `${x.title} — ${x.artist}` })),
      "t"
    ).slice(0, 5),
    recent: h.slice(-15).reverse(),
  };
}
