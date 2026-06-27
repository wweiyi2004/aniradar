import { prisma } from "@aniradar/db";
import { getAdapter } from "@aniradar/sources";
import { computeSignalHash } from "@aniradar/detector";
import type { FetchJobData } from "@aniradar/shared";
import { classifyQueue } from "./queues";

export async function processFetch(data: FetchJobData): Promise<void> {
  const source = await prisma.source.findUnique({ where: { id: data.sourceId } });
  if (!source || !source.enabled) return;

  const log = await prisma.fetchLog.create({
    data: { sourceId: source.id, status: "skipped", startedAt: new Date() },
  });

  try {
    const adapter = getAdapter(source.fetchStrategy);
    const result = await adapter.fetch(source);

    if (result.notModified) {
      await prisma.source.update({
        where: { id: source.id },
        data: { lastCheckedAt: new Date(), lastSuccessAt: new Date() },
      });
      await prisma.fetchLog.update({
        where: { id: log.id },
        data: { status: "skipped", message: "not modified", endedAt: new Date() },
      });
      return;
    }

    let newCount = 0;
    for (const item of result.items) {
      const hash = computeSignalHash(source.id, item);
      try {
        const signal = await prisma.signal.create({
          data: {
            sourceId: source.id,
            title: item.title,
            url: item.url,
            rawText: item.rawText,
            summary: item.summary,
            publishedAt: item.publishedAt,
            publishedTimePrecision: item.publishedTimePrecision,
            hash,
            status: "raw",
          },
        });
        newCount++;
        await classifyQueue.add("classify", { signalId: signal.id });
      } catch (e: unknown) {
        // 唯一约束冲突 = 重复内容，跳过
        if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") continue;
        throw e;
      }
    }

    const isHtmlOrDiff = source.fetchStrategy === "html_list" || source.fetchStrategy === "page_diff";
    const isFeed = source.fetchStrategy === "rss" || source.fetchStrategy === "youtube_rss";

    await prisma.source.update({
      where: { id: source.id },
      data: {
        lastCheckedAt: new Date(),
        lastSuccessAt: new Date(),
        failureCount: 0,
        etag: result.etag ?? source.etag,
        // htmlList/pageDiff 用 result.lastModified 回传内容指纹 → 写 lastSeenHash
        lastSeenHash: isHtmlOrDiff ? (result.lastModified ?? source.lastSeenHash) : source.lastSeenHash,
        // rss/youtube 的 lastModified 是 HTTP 头
        lastModified: isFeed ? (result.lastModified ?? source.lastModified) : source.lastModified,
      },
    });

    await prisma.fetchLog.update({
      where: { id: log.id },
      data: { status: "success", fetchedCount: result.items.length, newCount, endedAt: new Date() },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.source.update({
      where: { id: source.id },
      data: { lastCheckedAt: new Date(), failureCount: { increment: 1 } },
    });
    await prisma.fetchLog.update({
      where: { id: log.id },
      data: { status: "failed", message, endedAt: new Date() },
    });
  }
}
