import * as store from "./store.js";
import * as spotify from "./spotify.js";

// A cada intervalo, consulta todas as conexões e grava a faixa atual no histórico.
// Assim as métricas existem mesmo quando o widget não está aberto no OBS.

const SAMPLE_INTERVAL_MS = 30000; // 30s é suave com o rate limit do Spotify

async function sampleAll() {
  const conns = store.list();
  for (const c of conns) {
    try {
      const np = await spotify.fetchNowPlaying(c.id);
      if (np && np.is_playing && np.trackId) {
        store.recordPlay(c.id, {
          trackId: np.trackId,
          title: np.title,
          artist: np.artist,
          album: np.album,
          image: np.image,
          duration_ms: np.duration_ms,
        });
      }
    } catch (e) {
      // silencioso: uma conexão com erro não pode derrubar as outras
    }
  }
}

export function startPoller() {
  console.log(`  Poller de métricas ativo (a cada ${SAMPLE_INTERVAL_MS / 1000}s)`);
  setInterval(sampleAll, SAMPLE_INTERVAL_MS);
}
