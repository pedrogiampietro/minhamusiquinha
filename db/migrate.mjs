// Cria as tabelas no banco Neon.
// Uso:  npm run db:migrate
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

// Carrega .env.local e depois .env (sem sobrescrever)
dotenv.config({ path: ".env.local" });
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("\n[!] DATABASE_URL não encontrada em .env.local\n");
  process.exit(1);
}

const sql = neon(url);

async function run(label, fn) {
  try {
    await fn();
    console.log("  ✓ " + label);
  } catch (err) {
    console.error("  ✗ " + label + "\n    " + err.message);
    process.exit(1);
  }
}

console.log("\n  Aplicando schema no Neon...");

await run("connections", () =>
  sql`
    CREATE TABLE IF NOT EXISTS connections (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      profile    JSONB,
      tokens     JSONB NOT NULL,
      config     JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`
);

await run("idx_connections_user", () =>
  sql`CREATE INDEX IF NOT EXISTS idx_connections_user ON connections (user_id)`
);

await run("plays", () =>
  sql`
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
    )`
);

await run("idx_plays_conn", () =>
  sql`CREATE INDEX IF NOT EXISTS idx_plays_conn ON plays (connection_id, played_at DESC)`
);

// Credenciais do app Spotify de cada usuário (cada um cria o próprio app).
await run("spotify_apps", () =>
  sql`
    CREATE TABLE IF NOT EXISTS spotify_apps (
      user_id       TEXT PRIMARY KEY,
      client_id     TEXT NOT NULL,
      client_secret TEXT NOT NULL,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )`
);

console.log("\n  Migração concluída com sucesso.\n");
