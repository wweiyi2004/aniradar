import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aniradar/db";

// 仅允许后台 UI 实际暴露的人工态转换，禁止写回 draft_ai/auto_published 等内部态。
const ALLOWED = ["published", "ignored", "retracted", "needs_review"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const b = await req.json();
    if (!ALLOWED.includes(b.status)) {
      return NextResponse.json({ error: "bad status" }, { status: 400 });
    }
    const ev = await prisma.event.update({ where: { id }, data: { status: b.status } });
    return NextResponse.json(ev);
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 400 });
  }
}
