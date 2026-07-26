import type { MetadataRoute } from "next";
import { prisma } from "@aniradar/db";
import { getPublicEventStatuses } from "@/lib/public-status";
import { siteOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

// 最新 1000 条可见事件;更旧的靠内链发现,避免 sitemap 无限膨胀。
const MAX_EVENTS = 1000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const events = await prisma.event.findMany({
    where: { status: { in: [...getPublicEventStatuses()] } },
    orderBy: [{ publishedAt: "desc" }, { firstSeenAt: "desc" }],
    take: MAX_EVENTS,
    select: { id: true, updatedAt: true },
  });
  return [
    {
      url: origin,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    ...events.map((e) => ({
      url: `${origin}/events/${e.id}`,
      lastModified: e.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
