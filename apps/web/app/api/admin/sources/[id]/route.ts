import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@aniradar/db";
import { parseSourcePatch } from "@/lib/source-input";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
    }
    const parsed = parseSourcePatch(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const data: Prisma.SourceUpdateInput = {};
    if (parsed.name !== undefined) data.name = parsed.name;
    if (parsed.url !== undefined) data.url = parsed.url;
    if (parsed.type !== undefined) data.type = parsed.type;
    if (parsed.level !== undefined) data.level = parsed.level;
    if (parsed.fetchStrategy !== undefined) data.fetchStrategy = parsed.fetchStrategy;
    if (parsed.fetchIntervalSec !== undefined) data.fetchIntervalSec = parsed.fetchIntervalSec;
    if (parsed.enabled !== undefined) data.enabled = parsed.enabled;
    if (parsed.selectorConfig !== undefined) {
      // Prisma JSON 可空字段：清空须用 DbNull，不能传裸 null。
      data.selectorConfig =
        parsed.selectorConfig === null
          ? Prisma.DbNull
          : (parsed.selectorConfig as Prisma.InputJsonValue);
    }

    const src = await prisma.source.update({ where: { id: params.id }, data });
    return NextResponse.json(src);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
