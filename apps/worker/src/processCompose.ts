import { prisma } from "@aniradar/db";
import { composeArticle, type ComposeSource } from "@aniradar/ai";
import type { ComposeJobData } from "@aniradar/shared";

// 合成事件的中文整合正文：取事件所有 signal 的源/标题/正文，调 AI 合成一篇，写 Event.bodyZh。
// 无 AI / 无素材 / 调用失败时 composeArticle 返回 skipped，本处不覆盖既有 bodyZh。
export async function processCompose(data: ComposeJobData): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: data.eventId },
    include: {
      signals: {
        include: { source: { select: { name: true } } },
        orderBy: { firstSeenAt: "asc" },
      },
    },
  });
  if (!event) return;

  const sources: ComposeSource[] = event.signals.map((s) => ({
    name: s.source.name,
    title: s.title,
    text: s.rawText ?? s.summary ?? "",
    url: s.url,
  }));

  const result = await composeArticle({
    titleZh: event.titleZh ?? event.title,
    leadZh: event.summaryZh ?? "",
    sources,
  });
  if (result.source !== "ai") return;

  await prisma.event.update({ where: { id: event.id }, data: { bodyZh: result.bodyZh } });
}
