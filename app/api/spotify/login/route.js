import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import crypto from "crypto";
import * as store from "@/lib/store";
import { getBaseUrl } from "@/lib/base-url";

const SCOPES = "user-read-currently-playing user-read-playback-state";

export async function GET(req) {
  const base = getBaseUrl(req);
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", base));

  // credenciais do app do usuário (ou fallback do .env)
  const app = await store.getUserApp(userId);
  const clientId = app?.client_id || process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    // sem app configurado → volta pro painel pedindo para configurar
    return NextResponse.redirect(new URL("/?connect=1", base));
  }

  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: `${base}/api/spotify/callback`,
    state,
  });

  const res = NextResponse.redirect(
    `https://accounts.spotify.com/authorize?${params}`
  );
  res.cookies.set("spotify_state", state, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
  });
  return res;
}
