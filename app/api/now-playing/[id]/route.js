import { NextResponse } from "next/server";
import * as store from "@/lib/store";
import * as spotify from "@/lib/spotify";

// Público (sem auth) — consumido pelo widget no OBS.
export async function GET(_req, { params }) {
  const { id } = await params;
  const np = await spotify.fetchNowPlaying(id);

  if (np.error === "not_found") {
    return NextResponse.json(np, { status: 404 });
  }

  // Grava no histórico quando o widget consulta e há faixa tocando.
  if (np.is_playing && np.trackId) {
    try {
      await store.recordPlay(id, {
        trackId: np.trackId,
        title: np.title,
        artist: np.artist,
        album: np.album,
        image: np.image,
        duration_ms: np.duration_ms,
      });
    } catch (e) {
      // não deixa uma falha de gravação derrubar o widget
      console.error("recordPlay:", e.message);
    }
  }

  return NextResponse.json(np, {
    headers: { "Cache-Control": "no-store" },
  });
}
