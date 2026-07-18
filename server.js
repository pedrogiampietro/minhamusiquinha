import express from "express";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

import * as store from "./lib/store.js";
import * as spotify from "./lib/spotify.js";
import { startPoller } from "./lib/poller.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  BASE_URL = "http://127.0.0.1:8888",
  PORT = 8888,
} = process.env;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.error("\n[!] Faltam SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no .env\n");
  process.exit(1);
}

const REDIRECT_URI = `${BASE_URL}/callback`;
const SCOPES = "user-read-currently-playing user-read-playback-state";

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- OAuth ----------
app.get("/login", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("spotify_state", state, { httpOnly: true, maxAge: 600000 });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: SPOTIFY_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state,
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

app.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  if (!code || state !== req.cookies.spotify_state) {
    return res.status(400).send("State inválido. Tente conectar de novo.");
  }
  res.clearCookie("spotify_state");
  try {
    const tokens = await spotify.exchangeCode(code, REDIRECT_URI);
    const profile = await spotify.fetchProfile(tokens.access_token);
    const id = crypto.randomBytes(24).toString("hex");
    store.create(id, { profile, tokens });
    res.redirect(`/?connected=${id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao autenticar: " + err.message);
  }
});

// ---------- API do widget (pública via :id) ----------
app.get("/api/now-playing/:id", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const np = await spotify.fetchNowPlaying(req.params.id);
  if (np.error === "not_found") return res.status(404).json(np);
  // grava no histórico também quando o widget consulta
  if (np.is_playing && np.trackId) {
    store.recordPlay(req.params.id, {
      trackId: np.trackId, title: np.title, artist: np.artist,
      album: np.album, image: np.image, duration_ms: np.duration_ms,
    });
  }
  res.json(np);
});

app.get("/api/config/:id", (req, res) => {
  const d = store.read(req.params.id);
  if (!d) return res.status(404).json({ error: "not_found" });
  res.json(d.config);
});

// ---------- API do painel ----------
app.get("/api/connections", (req, res) => {
  const list = store.list().map((d) => ({
    id: d.id,
    profile: d.profile,
    createdAt: d.createdAt,
    plays: d.history.length,
  }));
  res.json(list);
});

app.get("/api/connection/:id", (req, res) => {
  const d = store.read(req.params.id);
  if (!d) return res.status(404).json({ error: "not_found" });
  res.json({ id: d.id, profile: d.profile, config: d.config, createdAt: d.createdAt });
});

app.put("/api/config/:id", (req, res) => {
  const updated = store.updateConfig(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: "not_found" });
  res.json(updated);
});

app.get("/api/metrics/:id", (req, res) => {
  const m = store.metrics(req.params.id);
  if (!m) return res.status(404).json({ error: "not_found" });
  res.json(m);
});

app.delete("/api/connection/:id", (req, res) => {
  const ok = store.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "not_found" });
  res.json({ removed: true });
});

// ---------- páginas ----------
app.get("/widget/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "widget.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.listen(PORT, () => {
  console.log(`\n  Spotify Widget rodando em ${BASE_URL}`);
  console.log(`  Painel: ${BASE_URL}`);
  startPoller();
  console.log("");
});
