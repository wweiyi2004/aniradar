import { prisma } from "@aniradar/db";
import { analyze } from "@aniradar/ai";
import type { ReanalyzeJobData } from "@aniradar/shared";
import { mergeFacts } from "./facts";
import { shouldReanalyze } from "./reanalyzePlan";

// AI 恢复后重分析：只升级译文/摘要，不改 category/heat/合并，保持幂等。
export async function processReanalyze(data: ReanalyzeJobData): Promise<void> {
  const signal = await prisma.signal.findUnique({ where: { id: data.signalId } });
  if (!signal || !shouldReanalyze(signal)) return;

  const result = await analyze({
    title: signal.title,
    summary: signal.summary ?? undefined,
    rawText: signal.rawText ?? undefined,
  });
  if (result.source !== "ai") return; // AI 仍不可用，保持 mock，下轮再试

  await prisma.signal.update({
    where: { id: signal.id },
    data: { titleZh: result.titleZh, aiSource: "ai" },
  });
  if (signal.eventId) {
    const ev = await prisma.event.findUnique({ where: { id: signal.eventId }, select: { medium: true, facts: true } });
    await prisma.event.update({
      where: { id: signal.eventId },
      data: {
        titleZh: result.titleZh,
        summaryZh: result.leadZh,
        medium: ev?.medium ?? result.medium,
        facts: mergeFacts(ev?.facts, result.facts) as object,
      },
    });
  }
}
