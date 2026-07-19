-- Schema do Spotify Now Playing Widget (Neon Postgres)

-- Uma linha por conta do Spotify conectada.
-- id  = identificador público usado na URL do widget (segredo aleatório).
-- user_id = ID do usuário no Clerk (dono da conexão).
CREATE TABLE IF NOT EXISTS connections (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  profile    JSONB,
  tokens     JSONB NOT NULL,
  config     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_connections_user ON connections (user_id);

-- Histórico de reproduções (uma linha por faixa detectada).
CREATE TABLE IF NOT EXISTS plays (
  id            BIGSERIAL PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES connections (id) ON DELETE CASCADE,
  track_id      TEXT,
  title         TEXT,
  artist        TEXT,
  album         TEXT,
  image         TEXT,
  duration_ms   INTEGER,
  played_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plays_conn ON plays (connection_id, played_at DESC);

-- Credenciais do app Spotify de cada usuário (cada um cria o próprio app).
CREATE TABLE IF NOT EXISTS spotify_apps (
  user_id       TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
