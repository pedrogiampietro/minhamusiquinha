import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import crypto from "crypto";
import * as store from "@/lib/store";
import * as spotify from "@/lib/spotify";
import { getBaseUrl } from "@/lib/base-url";

export async function GET(req) {
  const base = getBaseUrl(req);
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", base));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("spotify_state")?.value;

  if (!code || !state || state !== cookieState) {
    return new NextResponse("State inválido. Tente conectar de novo.", {
      status: 400,
    });
  }

  try {
    const redirectUri = `${base}/api/spotify/callback`;
    const app = await store.getUserApp(userId);
    const tokens = await spotify.exchangeCode(code, redirectUri, app);
    const profile = await spotify.fetchProfile(tokens.access_token);
    const id = crypto.randomBytes(24).toString("hex");
    await store.create(id, { userId, profile, tokens });

    const res = NextResponse.redirect(new URL(`/?connected=${id}`, base));
    res.cookies.delete("spotify_state");
    return res;
  } catch (err) {
    console.error(err);
    return new NextResponse("Erro ao autenticar: " + err.message, {
      status: 500,
    });
  }
}
