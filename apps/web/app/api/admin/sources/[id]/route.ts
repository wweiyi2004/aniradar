import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aniradar/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const b = await req.json();
    const data: Record<string, unknown> = {};
    for (const k of ["name", "url", "type", "level", "fetchStrategy", "enabled"]) {
      if (k in b) data[k] = b[k];
    }
    if ("fetchIntervalSec" in b) data.fetchIntervalSec = Number(b.fetchIntervalSec);
    if ("selectorConfig" in b) {
      data.selectorConfig =
        b.selectorConfig && String(b.selectorConfig).trim() ? JSON.parse(b.selectorConfig) : null;
    }
    const src = await prisma.source.update({ where: { id: params.id }, data });
    return NextResponse.json(src);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
