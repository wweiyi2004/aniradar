import { prisma } from "@aniradar/db";
import { getAdapter, enrichItems } from "@aniradar/sources";
import { computeSignalHash } from "@aniradar/detector";
import type { FetchJobData } from "@aniradar/shared";
import { classifyQueue } from "./queues";
import { env } from "@aniradar/config";
import { pickToEnrich } from "./enrichPlan";
import { shouldRetry, type RetryCtx } from "./retry";

export async function processFetch(data: FetchJobData, ctx?: RetryCtx): Promise<void> {
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

    // 先按 hash 找出新条目，仅对新条目抓详情页增强（正文全文 + 主图），避免对重复项浪费请求。
    const hashed = result.items.map((item) => ({ item, hash: computeSignalHash(source.id, item) }));
    const existing = await prisma.signal.findMany({
      where: { hash: { in: hashed.map((h) => h.hash) } },
      select: { hash: true },
    });
    const existingHashes = new Set(existing.map((e) => e.hash));
    const fresh = hashed.filter((h) => !existingHashes.has(h.hash));

    // 限流：仅对最新 enrichMaxPerCycle 条抓详情页，其余照常入库但不增强。
    const { toEnrich, rest } = pickToEnrich(fresh, env.enrichMaxPerCycle);
    const enrichedItems = await enrichItems(
      toEnrich.map((e) => e.item),
      source.fetchStrategy,
    );
    const ordered = [...toEnrich, ...rest];
    const enriched = [...enrichedItems, ...rest.map((e) => e.item)];

    let newCount = 0;
    for (let i = 0; i < ordered.length; i++) {
      const item = enriched[i];
      const hash = ordered[i].hash;
      try {
        const signal = await prisma.signal.create({
          data: {
            sourceId: source.id,
            title: item.title,
            url: item.url,
            rawText: item.rawText,
            summary: item.summary,
            imageUrl: item.imageUrl,
            videoUrl: item.videoUrl,
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
    await prisma.fetchLog.update({
      where: { id: log.id },
      data: { status: "failed", message, endedAt: new Date() },
    });
    if (shouldRetry(e, ctx)) throw e; // 瞬时网络错误交 BullMQ 重试
    await prisma.source.update({
      where: { id: source.id },
      data: { lastCheckedAt: new Date(), failureCount: { increment: 1 } },
    });
  }
}
