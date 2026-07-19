import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as store from "@/lib/store";

// GET: informa se o usuário já configurou um app (sem devolver o secret).
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const app = await store.getUserApp(userId);
  return NextResponse.json({
    configured: !!app,
    clientId: app?.client_id || null,
  });
}

// POST: salva/atualiza as credenciais do app Spotify do usuário.
export async function POST(req) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const clientId = (body.clientId || "").trim();
  const clientSecret = (body.clientSecret || "").trim();

  if (!clientId) {
    return NextResponse.json({ error: "Informe o Client ID." }, { status: 400 });
  }

  const existing = await store.getUserApp(userId);
  // Sem secret informado: só é permitido se já houver um salvo (mantém o antigo).
  if (!clientSecret && !existing) {
    return NextResponse.json(
      { error: "Informe o Client Secret." },
      { status: 400 }
    );
  }

  const secretToSave = clientSecret || existing.client_secret;
  await store.saveUserApp(userId, clientId, secretToSave);
  return NextResponse.json({ ok: true });
}
