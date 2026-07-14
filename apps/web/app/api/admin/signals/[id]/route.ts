import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aniradar/db";
import { SIGNAL_STATUS } from "@aniradar/shared";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const b = await req.json();
    if (!SIGNAL_STATUS.includes(b.status)) {
      return NextResponse.json({ error: "bad status" }, { status: 400 });
    }

    // ignore：若该 Signal 是 Event 唯一来源，且 Event 仍为自动态，则一并撤回，避免“信号忽略但事件仍公开”
    if (b.status === "ignored") {
      const updated = await prisma.$transaction(async (tx) => {
        const signal = await tx.signal.update({ where: { id }, data: { status: "ignored" } });
        if (signal.eventId) {
          const siblings = await tx.signal.count({
            where: { eventId: signal.eventId, status: { not: "ignored" }, id: { not: signal.id } },
          });
          if (siblings === 0) {
            await tx.event.updateMany({
              where: {
                id: signal.eventId,
                status: { in: ["draft_ai", "auto_published", "needs_review"] },
              },
              data: { status: "ignored" },
            });
          }
        }
        return signal;
      });
      return NextResponse.json(updated);
    }

    const s = await prisma.signal.update({ where: { id }, data: { status: b.status } });
    return NextResponse.json(s);
  } catch (e: unknown) {
    return NextResponse.json({ error: "更新失败" }, { status: 400 });
  }
}
