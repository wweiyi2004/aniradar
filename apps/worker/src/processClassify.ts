import { enqueueJob, jobKeys, prisma, workKeyFromFacts } from "@aniradar/db";
import { analyze, isAiConfigured, looksNonNews, type AnalyzeResult } from "@aniradar/ai";
import { buildEventFromSignal, isSameEvent, compatibleCategories } from "@aniradar/detector";
import type { ClassifyJobData } from "@aniradar/shared";
import type { Signal, Source } from "@aniradar/db";
import { shouldRetry, type RetryCtx } from "./retry";
import { mergeFacts } from "./facts";

// 合并时间窗：仅在最近这段时间内的同分类 Event 里寻找可合并目标。
const MERGE_WINDOW_MS = 72 * 60 * 60 * 1000;

type SignalWithSource = Signal & { source: Source };

export async function applyAnalyzeResult(
  signal: SignalWithSource,
  result: AnalyzeResult,
): Promise<void> {
  if (!result.isAnimeNews) {
    await prisma.signal.updateMany({
      where: { id: signal.id, status: "raw" },
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
    analysisSource: result.source,
  });

  // 寻找可合并的既有 Event（最近窗口内、兼容分类、未被忽略/撤回/合并）。
  // 有 workKey 时优先精确查，避免 take 窗口漏掉真实合并目标。
  const since = new Date(Date.now() - MERGE_WINDOW_MS);
  const cats = compatibleCategories(result.category);
  const workOf = (facts: unknown): string | null => {
    const w = (facts as Record<string, unknown> | null)?.work;
    return typeof w === "string" && w.trim() ? w.trim() : null;
  };
  const incomingWork = workOf(result.facts);
  const incomingWorkKey = workKeyFromFacts(result.facts);
  const baseWhere = {
    firstSeenAt: { gte: since },
    status: {
      notIn: ["ignored", "retracted", "merged"] as Array<"ignored" | "retracted" | "merged">,
    },
  };
  const candidates = incomingWorkKey
    ? await prisma.event.findMany({
        where: { ...baseWhere, workKey: incomingWorkKey },
        orderBy: { firstSeenAt: "desc" },
        take: 100,
      })
    : await prisma.event.findMany({
        where: {
          ...baseWhere,
          ...(cats ? { category: { in: cats } } : {}),
        },
        orderBy: { firstSeenAt: "desc" },
        take: 100,
      });
  const target = candidates.find((c) =>
    isSameEvent(
      { title: c.title, category: c.category, work: workOf(c.facts) },
      { title: signal.title, category: result.category, work: incomingWork },
    ),
  );

  // 事件"出现时间"：优先用情报自带发布时间，缺失回退入库时间；合并时取更早者。
  const sigPub = signal.publishedAt ?? signal.firstSeenAt;
  const shouldCompose = isAiConfigured();

  if (target) {
    // 合并：挂到既有事件，累加热度，必要时提升官方确认/置信度/状态。
    // 状态只升不降（needs_review < draft_ai < auto_published）；人工态（published 等）不动。
    // 事件写 + signal 写放进同一事务；signal 用 status=raw CAS，双投递时只有一方能写热度。
    const STATUS_RANK: Record<string, number> = { needs_review: 0, draft_ai: 1, auto_published: 2 };
    const canUpgrade =
      target.status in STATUS_RANK &&
      built.status in STATUS_RANK &&
      STATUS_RANK[built.status] > STATUS_RANK[target.status];
    // 弱标签 other 在合并到更具体分类的信号时升级（配合 work 强键的跨分类合并）。
    const upgradeCategory = target.category === "other" && result.category !== "other";
    const mergedFacts = mergeFacts(target.facts, result.facts);
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.signal.updateMany({
        where: { id: signal.id, status: "raw" },
        data: {
          status: "classified",
          eventId: target.id,
          titleZh: result.titleZh,
          aiSource: result.source,
        },
      });
      if (claimed.count !== 1) return;
      await tx.event.update({
        where: { id: target.id },
        data: {
          heatScore: { increment: 1 },
          officialConfirmed: target.officialConfirmed || built.officialConfirmed,
          confidence: Math.max(target.confidence, built.confidence),
          imageUrl: target.imageUrl ?? signal.imageUrl,
          videoUrl: target.videoUrl ?? signal.videoUrl,
          medium: target.medium ?? result.medium,
          facts: mergedFacts as object,
          workKey: workKeyFromFacts(mergedFacts) ?? target.workKey,
          publishedAt:
            target.publishedAt && target.publishedAt < sigPub ? target.publishedAt : sigPub,
          ...(canUpgrade ? { status: built.status } : {}),
          ...(upgradeCategory ? { category: result.category } : {}),
        },
      });
      if (shouldCompose) {
        await enqueueJob(tx, {
          type: "compose",
          dedupeKey: jobKeys.compose(target.id, signal.id),
          payload: { eventId: target.id },
        });
      }
    });
    return;
  }

  // 无可合并目标：新建 Event。signal CAS 失败则回滚整事务，避免重复 Event。
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.signal.updateMany({
      where: { id: signal.id, status: "raw" },
      data: { status: "classified", titleZh: result.titleZh, aiSource: result.source },
    });
    if (claimed.count !== 1) return;
    const ev = await tx.event.create({
      data: {
        title: built.title,
        titleZh: result.titleZh,
        summaryZh: result.leadZh,
        medium: result.medium,
        facts: result.facts as object,
        workKey: workKeyFromFacts(result.facts),
        imageUrl: signal.imageUrl,
        videoUrl: signal.videoUrl,
        category: built.category,
        firstSeenAt: built.firstSeenAt,
        publishedAt: sigPub,
        confidence: built.confidence,
        officialConfirmed: built.officialConfirmed,
        status: built.status,
        heatScore: 1,
      },
    });
    await tx.signal.update({
      where: { id: signal.id },
      data: { eventId: ev.id },
    });
    if (shouldCompose) {
      await enqueueJob(tx, {
        type: "compose",
        dedupeKey: jobKeys.compose(ev.id, signal.id),
        payload: { eventId: ev.id },
      });
    }
  });
}

export async function processClassify(data: ClassifyJobData, ctx?: RetryCtx): Promise<void> {
  const signal = await prisma.signal.findUnique({
    where: { id: data.signalId },
    include: { source: true },
  });
  // SQLite Job 是至少一次投递；只有 raw 信号可进入首次分类。最终写库用 status=raw CAS。
  if (!signal || signal.status !== "raw") return;

  try {
    // 招聘/公司 HR 类明显非情报：调 AI 前直接判忽略，省调用、不污染情报流。
    if (looksNonNews(signal.title)) {
      await prisma.signal.updateMany({
        where: { id: signal.id, status: "raw" },
        data: { status: "ignored", titleZh: signal.title, aiSource: "prefilter" },
      });
      return;
    }

    // 一次调用完成：是否动漫情报 + 分类 + 置信度 + 中文标题/摘要（无 key 时回退规则 mock）
    const result = await analyze({
      title: signal.title,
      summary: signal.summary ?? undefined,
      rawText: signal.rawText ?? undefined,
      sourceType: signal.source.type,
    });

    await applyAnalyzeResult(signal, result);
  } catch (e) {
    if (shouldRetry(e, ctx)) throw e; // 瞬时错误（多为 DB 抖动）交持久化 Job runner 重试
    await prisma.signal.updateMany({
      where: { id: signal.id, status: "raw" },
      data: { status: "failed" },
    });
  }
}
