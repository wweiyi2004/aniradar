import { NextResponse } from "next/server";
import { getFetchQueue } from "@/lib/queue";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    await getFetchQueue().add("fetch", { sourceId: params.id });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
