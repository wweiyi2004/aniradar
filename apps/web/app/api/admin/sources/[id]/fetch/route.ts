import { NextResponse } from "next/server";
import { prisma } from "@aniradar/db";
import { enqueueFetch } from "@/lib/queue";

// 简单进程内频控：同一 source 3 秒内只允许一次手动抓取
const lastFetchAt = new Map<string, number>();
const MIN_INTERVAL_MS = 3000;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const source = await prisma.source.findUnique({ where: { id }, select: { id: true } });
    if (!source) return NextResponse.json({ error: "source not found" }, { status: 404 });

    const now = Date.now();
    const prev = lastFetchAt.get(id) ?? 0;
    if (now - prev < MIN_INTERVAL_MS) {
      return NextResponse.json({ error: "请稍后再试" }, { status: 429 });
    }
    lastFetchAt.set(id, now);

    await enqueueFetch(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "入队失败" }, { status: 500 });
  }
}
