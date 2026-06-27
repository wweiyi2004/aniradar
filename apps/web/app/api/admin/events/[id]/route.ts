import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aniradar/db";

const ALLOWED = [
  "published",
  "ignored",
  "retracted",
  "needs_review",
  "auto_published",
  "draft_ai",
];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const b = await req.json();
    if (!ALLOWED.includes(b.status)) {
      return NextResponse.json({ error: "bad status" }, { status: 400 });
    }
    const ev = await prisma.event.update({ where: { id: params.id }, data: { status: b.status } });
    return NextResponse.json(ev);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
