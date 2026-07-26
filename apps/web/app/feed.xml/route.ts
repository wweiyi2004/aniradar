import type { NextRequest } from "next/server";
import { prisma } from "@aniradar/db";
import { MEDIUMS } from "@aniradar/shared";
import { getPublicEventStatuses } from "@/lib/public-status";
import { resolveOrigin } from "@/lib/origin";
import { buildRssXml } from "@/lib/rss";
import { CATEGORY_LABEL, MEDIUM_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

const FEED_SIZE = 50;

export async function GET(request: NextRequest) {
  const origin = resolveOrigin(request.headers) ?? "http://localhost:3000";
  const boardParam = request.nextUrl.searchParams.get("board");
  // 非法 board 忽略(返回全量),与首页行为一致。
  const board =
    boardParam && (MEDIUMS as readonly string[]).includes(boardParam)
      ? boardParam
      : undefined;

  const events = await prisma.event.findMany({
    where: {
      status: { in: [...getPublicEventStatuses()] },
      ...(board ? { medium: board } : {}),
    },
    orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
    take: FEED_SIZE,
    select: {
      id: true,
      title: true,
      titleZh: true,
      summaryZh: true,
      category: true,
      publishedAt: true,
      firstSeenAt: true,
    },
  });

  const boardLabel = board ? MEDIUM_LABEL[board] : undefined;
  const xml = buildRssXml({
    title: boardLabel
      ? `AniRadar · 次元情报站 · ${boardLabel}`
      : "AniRadar · 次元情报站",
    link: board ? `${origin}/?board=${board}` : origin,
    feedUrl: board ? `${origin}/feed.xml?board=${board}` : `${origin}/feed.xml`,
    description: "实时捕捉动画、漫画、游戏与轻小说的新情报。",
    language: "zh-cn",
    lastBuildDate: new Date(),
    items: events.map((e) => ({
      title: e.titleZh?.trim() || e.title,
      link: `${origin}/events/${e.id}`,
      description: e.summaryZh ?? undefined,
      pubDate: e.publishedAt ?? e.firstSeenAt,
      category: CATEGORY_LABEL[e.category] ?? e.category,
    })),
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // RSS 阅读器轮询频繁,给 5 分钟缓存余量。
      "Cache-Control": "public, max-age=300",
    },
  });
}
