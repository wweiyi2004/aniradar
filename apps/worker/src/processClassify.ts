import { prisma } from "@aniradar/db";
import { analyze } from "@aniradar/ai";
import { buildEventFromSignal, isSameEvent } from "@aniradar/detector";
import type { ClassifyJobData } from "@aniradar/shared";
import { shouldRetry, type RetryCtx } from "./retry";
import { mergeFacts } from "./facts";

// 合并时间窗：仅在最近这段时间内的同分类 Event 里寻找可合并目标。
const MERGE_WINDOW_MS = 72 * 60 * 60 * 1000;

export async function processClassify(data: ClassifyJobData, ctx?: RetryCtx): Promise<void> {
  const signal = await prisma.signal.findUnique({
    where: { id: data.signalId },
    include: { source: true },
  });
  if (!signal) return;

  try {
    // 一次调用完成：是否动漫情报 + 分类 + 置信度 + 中文标题/摘要（无 key 时回退规则 mock）
    const result = await analyze({
      title: signal.title,
      summary: signal.summary ?? undefined,
      rawText: signal.rawText ?? undefined,
    });

    if (!result.isAnimeNews) {
      await prisma.signal.update({
        where: { id: signal.id },
        data: { status: "ignored", titleZh: result.titleZh, aiSource: result.source },
      });
      return;
    }

    const built = buildEventFromSignal({
      title: signal.title,
      category: result.category,
      confidence: result.confidence,
      firstSeenAt: signal.firstSeenAt,
      sourceType: signal.source.type,
    });

    // 寻找可合并的既有 Event（最近窗口内、同分类、未被忽略/撤回/合并）。
    const since = new Date(Date.now() - MERGE_WINDOW_MS);
    const candidates = await prisma.event.findMany({
      where: {
        category: result.category,
        firstSeenAt: { gte: since },
        status: { notIn: ["ignored", "retracted", "merged"] },
      },
      orderBy: { firstSeenAt: "desc" },
      take: 50,
    });
    const target = candidates.find((c) =>
      isSameEvent({ title: c.title, category: c.category }, { title: signal.title, category: result.category }),
    );

    if (target) {
      // 合并：挂到既有事件，累加热度，必要时提升官方确认/置信度/状态。
      // 事件写 + signal 写放进同一事务：瞬时失败重试时整体回滚，避免重放导致热度重复累加。
      const upgradeToAuto = built.status === "auto_published" && target.status === "draft_ai";
      await prisma.$transaction(async (tx) => {
        await tx.event.update({
          where: { id: target.id },
          data: {
            heatScore: { increment: 1 },
            officialConfirmed: target.officialConfirmed || built.officialConfirmed,
            confidence: Math.max(target.confidence, built.confidence),
            imageUrl: target.imageUrl ?? signal.imageUrl,
            videoUrl: target.videoUrl ?? signal.videoUrl,
            medium: target.medium ?? result.medium,
            facts: mergeFacts(target.facts, result.facts) as object,
            ...(upgradeToAuto ? { status: "auto_published" } : {}),
          },
        });
        await tx.signal.update({
          where: { id: signal.id },
          data: { status: "classified", eventId: target.id, titleZh: result.titleZh, aiSource: result.source },
        });
      });
      return;
    }

    // 无可合并目标：新建 Event。事件创建 + signal 写放进同一事务：
    // 瞬时失败重试时整体回滚，避免重放产生重复事件。
    await prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          title: built.title,
          titleZh: result.titleZh,
          summaryZh: result.leadZh,
          medium: result.medium,
          facts: result.facts as object,
          imageUrl: signal.imageUrl,
          videoUrl: signal.videoUrl,
          category: built.category,
          firstSeenAt: built.firstSeenAt,
          confidence: built.confidence,
          officialConfirmed: built.officialConfirmed,
          status: built.status,
          heatScore: 1,
        },
      });
      await tx.signal.update({
        where: { id: signal.id },
        data: { status: "classified", eventId: event.id, titleZh: result.titleZh, aiSource: result.source },
      });
    });
  } catch (e) {
    if (shouldRetry(e, ctx)) throw e; // 瞬时错误（多为 DB 抖动）交 BullMQ 重试
    await prisma.signal.update({ where: { id: signal.id }, data: { status: "failed" } });
  }
}
