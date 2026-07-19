import { neon } from "@neondatabase/serverless";

// Cliente HTTP do Neon (serverless-friendly). Inicialização preguiçosa para
// não quebrar o build quando DATABASE_URL ainda não está definida.
let _sql = null;

export function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL não configurada. Adicione a connection string do Neon no .env.local"
      );
    }
    _sql = neon(url);
  }
  return _sql;
}
