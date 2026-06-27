import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aniradar/db";
import { SIGNAL_STATUS } from "@aniradar/shared";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const b = await req.json();
    if (!SIGNAL_STATUS.includes(b.status)) {
      return NextResponse.json({ error: "bad status" }, { status: 400 });
    }
    const s = await prisma.signal.update({ where: { id: params.id }, data: { status: b.status } });
    return NextResponse.json(s);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
