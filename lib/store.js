import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Um arquivo JSON por conexão: data/<id>.json
// { id, profile, tokens, config, history: [...], createdAt }

export const DEFAULT_CONFIG = {
  bars: 24,
  poll: 3000,
  accent: "#1db954",
  bg: "#0d0d0d",
  card: "#171717",
  showAlbum: false,
  scrollTitle: true,
  cornerRadius: 26,
  hideWhenPaused: false,
};

const filePath = (id) => path.join(DATA_DIR, `${id}.json`);

export function exists(id) {
  return fs.existsSync(filePath(id));
}

export function read(id) {
  if (!exists(id)) return null;
  return JSON.parse(fs.readFileSync(filePath(id), "utf8"));
}

function write(id, data) {
  fs.writeFileSync(filePath(id), JSON.stringify(data, null, 2));
}

export function create(id, { profile, tokens }) {
  const data = {
    id,
    profile: profile || null,
    tokens,
    config: { ...DEFAULT_CONFIG },
    history: [],
    createdAt: Date.now(),
  };
  write(id, data);
  return data;
}

export function updateTokens(id, tokens) {
  const d = read(id);
  if (!d) return null;
  d.tokens = tokens;
  write(id, d);
  return d;
}

export function updateConfig(id, patch) {
  const d = read(id);
  if (!d) return null;
  d.config = { ...DEFAULT_CONFIG, ...d.config, ...patch };
  write(id, d);
  return d.config;
}

export function updateProfile(id, profile) {
  const d = read(id);
  if (!d) return null;
  d.profile = profile;
  write(id, d);
  return d;
}

export function remove(id) {
  if (!exists(id)) return false;
  fs.unlinkSync(filePath(id));
  return true;
}

export function list() {
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => read(f.replace(/\.json$/, "")))
    .filter(Boolean);
}

// ---- histórico / métricas ----
// Guarda uma entrada quando uma faixa nova é detectada.
// history: [{ trackId, title, artist, album, image, playedAt, duration_ms }]

const MAX_HISTORY = 500;

export function recordPlay(id, track) {
  const d = read(id);
  if (!d) return;
  const last = d.history[d.history.length - 1];
  // evita duplicar a mesma faixa em amostragens seguidas
  if (last && last.trackId === track.trackId) return;
  d.history.push({ ...track, playedAt: Date.now() });
  if (d.history.length > MAX_HISTORY) {
    d.history = d.history.slice(-MAX_HISTORY);
  }
  write(id, d);
}

export function metrics(id) {
  const d = read(id);
  if (!d) return null;
  const h = d.history;
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
    topTracks: countBy(h.map((x) => ({ t: `${x.title} — ${x.artist}` })), "t").slice(0, 5),
    recent: h.slice(-15).reverse(),
  };
}
