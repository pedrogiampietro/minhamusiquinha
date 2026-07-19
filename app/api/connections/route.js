import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as store from "@/lib/store";

// Lista as conexões do usuário logado.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const list = await store.listByUser(userId);
  return NextResponse.json(list);
}
