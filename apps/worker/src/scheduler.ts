import { prisma } from "@aniradar/db";
import { env } from "@aniradar/config";
import { isAiConfigured } from "@aniradar/ai";
import { fetchQueue, reanalyzeQueue } from "./queues";

export async function tick(): Promise<void> {
  const now = Date.now();
  const sources = await prisma.source.findMany({ where: { enabled: true } });
  for (const s of sources) {
    const due =
      !s.lastCheckedAt || now - new Date(s.lastCheckedAt).getTime() >= s.fetchIntervalSec * 1000;
    if (due) {
      await fetchQueue.add("fetch", { sourceId: s.id }, { removeOnComplete: 100, removeOnFail: 100 });
    }
  }
}

// 周期性把 mock 定型、近窗口内、已挂事件的 signal 入队重分析；无 AI 配置时跳过。
export async function reanalyzeTick(): Promise<void> {
  if (!isAiConfigured()) return;
  const since = new Date(Date.now() - env.reanalyzeWindowHours * 60 * 60 * 1000);
  const signals = await prisma.signal.findMany({
    where: {
      aiSource: "mock",
      status: "classified",
      eventId: { not: null },
      firstSeenAt: { gte: since },
    },
    orderBy: { firstSeenAt: "desc" },
    take: env.reanalyzeBatch,
    select: { id: true },
  });
  for (const s of signals) {
    await reanalyzeQueue.add(
      "reanalyze",
      { signalId: s.id },
      { removeOnComplete: 200, removeOnFail: 200 },
    );
  }
}

export function startScheduler(): NodeJS.Timeout[] {
  tick().catch((e) => console.error("scheduler tick error", e));
  reanalyzeTick().catch((e) => console.error("reanalyze tick error", e));
  const fetchTimer = setInterval(() => {
    tick().catch((e) => console.error("scheduler tick error", e));
  }, env.schedulerIntervalMs);
  const reanalyzeTimer = setInterval(() => {
    reanalyzeTick().catch((e) => console.error("reanalyze tick error", e));
  }, env.reanalyzeIntervalMs);
  return [fetchTimer, reanalyzeTimer];
}
