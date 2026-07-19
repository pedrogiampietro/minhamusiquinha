import { NextResponse } from "next/server";
import crypto from "crypto";

const SCOPES = "user-read-currently-playing user-read-playback-state";

export async function GET() {
  const base = process.env.BASE_URL || "http://127.0.0.1:8888";
  const state = crypto.randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID || "",
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
