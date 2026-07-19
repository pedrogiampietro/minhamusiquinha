import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as store from "@/lib/store";

export async function GET(_req, { params }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const conn = await store.read(id);
  if (!conn || conn.user_id !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const m = await store.metrics(id);
  return NextResponse.json(m);
}
