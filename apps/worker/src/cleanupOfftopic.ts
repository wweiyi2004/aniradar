import { prisma } from "@aniradar/db";
import { analyze, isAiConfigured } from "@aniradar/ai";

// 一次性清理：用收紧后的"日本二次元"判定重跑所有公开可见事件的相关性，
// 离题的（isAnimeNews=false）把事件与其信号一并标 ignored。
// 只信任真 AI 的判定（mock 回退的跳过不动）；默认 dry-run，设 APPLY=1 才真正执行。
const APPLY = process.env.APPLY === "1";
const CONCURRENCY = 4;

interface Verdict {
  eventId: string;
  title: string;
  offTopic: boolean;
  skipped: boolean;
}

async function judge(event: {
  id: string;
  title: string;
  titleZh: string | null;
  signals: { title: string; summary: string | null; rawText: string | null; source: { type: string } }[];
}): Promise<Verdict> {
  const title = event.titleZh ?? event.title;
  // 素材最全的信号作为判定输入（优先带正文的）。
  const sig = event.signals.find((s) => (s.rawText ?? "").length > 0) ?? event.signals[0];
  if (!sig) return { eventId: event.id, title, offTopic: false, skipped: true };
  const result = await analyze({
    title: sig.title,
    summary: sig.summary ?? undefined,
    rawText: sig.rawText ?? undefined,
    sourceType: sig.source.type,
  });
  // AI 调用失败会回退 mock —— 清洗只信任真 AI 的否定判定，mock 结果跳过。
  if (result.source !== "ai") return { eventId: event.id, title, offTopic: false, skipped: true };
  return { eventId: event.id, title, offTopic: !result.isAnimeNews, skipped: false };
}

async function main() {
  if (!isAiConfigured()) {
    console.error("未配置 AI_API_KEY，清洗需要真 AI 判定，退出。");
    process.exit(1);
  }
  const events = await prisma.event.findMany({
    where: { status: { in: ["auto_published", "published", "draft_ai"] } },
    orderBy: { firstSeenAt: "asc" },
    select: {
      id: true,
      title: true,
      titleZh: true,
      signals: {
        orderBy: { firstSeenAt: "asc" },
        select: { title: true, summary: true, rawText: true, source: { select: { type: true } } },
      },
    },
  });
  console.log(`可见事件 ${events.length} 条，开始重判（并发 ${CONCURRENCY}）… APPLY=${APPLY}`);

  const verdicts: Verdict[] = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < events.length) {
        const ev = events[cursor++];
        const v = await judge(ev);
        verdicts.push(v);
        if (v.offTopic) console.log(`  离题: ${v.title}`);
        if (verdicts.length % 50 === 0) console.log(`  …已判 ${verdicts.length}/${events.length}`);
      }
    }),
  );

  const offTopic = verdicts.filter((v) => v.offTopic);
  const skipped = verdicts.filter((v) => v.skipped);
  console.log(`\n重判完成：离题 ${offTopic.length} / 跳过(AI失败) ${skipped.length} / 共 ${verdicts.length}`);

  if (!APPLY) {
    console.log("(dry-run：未改动。确认无误后用 APPLY=1 再跑一次执行。)");
    process.exit(0);
  }

  for (const v of offTopic) {
    await prisma.$transaction(async (tx) => {
      await tx.event.update({ where: { id: v.eventId }, data: { status: "ignored" } });
      await tx.signal.updateMany({ where: { eventId: v.eventId }, data: { status: "ignored" } });
    });
  }
  console.log(`cleanup done: ${offTopic.length} 条事件已标 ignored`);
  process.exit(0);
}

main();
