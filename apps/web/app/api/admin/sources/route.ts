import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aniradar/db";

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    if (!b.name || !b.url || !b.type || !b.fetchStrategy) {
      return NextResponse.json({ error: "name/url/type/fetchStrategy 必填" }, { status: 400 });
    }
    const src = await prisma.source.create({
      data: {
        name: b.name,
        url: b.url,
        type: b.type,
        level: b.level ?? "B",
        fetchStrategy: b.fetchStrategy,
        fetchIntervalSec: Number(b.fetchIntervalSec ?? 900),
        enabled: b.enabled ?? true,
        selectorConfig:
          b.selectorConfig && String(b.selectorConfig).trim()
            ? JSON.parse(b.selectorConfig)
            : undefined,
      },
    });
    return NextResponse.json(src);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
