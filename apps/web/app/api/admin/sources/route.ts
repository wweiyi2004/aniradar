import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@aniradar/db";
import { parseSourceCreate } from "@/lib/source-input";

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
    }
    const parsed = parseSourceCreate(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const src = await prisma.source.create({
      data: {
        name: parsed.name,
        url: parsed.url,
        type: parsed.type,
        level: parsed.level,
        fetchStrategy: parsed.fetchStrategy,
        fetchIntervalSec: parsed.fetchIntervalSec,
        enabled: parsed.enabled,
        selectorConfig: parsed.selectorConfig as object | undefined,
      },
    });
    return NextResponse.json(src);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
