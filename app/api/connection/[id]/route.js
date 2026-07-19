import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as store from "@/lib/store";

async function owned(id) {
  const { userId } = await auth();
  if (!userId) return { error: 401 };
  const conn = await store.read(id);
  if (!conn || conn.user_id !== userId) return { error: 404 };
  return { conn };
}

export async function GET(_req, { params }) {
  const { id } = await params;
  const { conn, error } = await owned(id);
  if (error) return NextResponse.json({ error: "not_found" }, { status: error });
  return NextResponse.json({
    id: conn.id,
    profile: conn.profile,
    config: { ...(await store.readConfig(id)) },
    createdAt: new Date(conn.created_at).getTime(),
  });
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  const { error } = await owned(id);
  if (error) return NextResponse.json({ error: "not_found" }, { status: error });
  await store.remove(id);
  return NextResponse.json({ removed: true });
}
