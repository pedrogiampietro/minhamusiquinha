import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as store from "@/lib/store";

// GET público — o widget lê sua própria config.
export async function GET(_req, { params }) {
  const { id } = await params;
  const config = await store.readConfig(id);
  if (!config) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(config, {
    headers: { "Cache-Control": "no-store" },
  });
}

// PUT protegido — só o dono (usuário Clerk) altera a config.
export async function PUT(req, { params }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const conn = await store.read(id);
  if (!conn || conn.user_id !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const patch = await req.json().catch(() => ({}));
  const updated = await store.updateConfig(id, patch);
  return NextResponse.json(updated);
}
