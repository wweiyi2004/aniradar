import { enqueueJob, jobKeys, prisma } from "@aniradar/db";
import { env } from "@aniradar/config";
import { isAiConfigured } from "@aniradar/ai";
import { backupDatabase, claimDailyRun, cleanupFetchLogs, decayHeatScores } from "./maintenance";

// 维护任务(FetchLog 清理等)幂等且开销小,6 小时一轮足够。
const MAINTENANCE_INTERVAL_MS = 6 * 60 * 60 * 1000;

export async function tick(): Promise<void> {
  const now = Date.now();
  const sources = await prisma.source.findMany({ where: { enabled: true } });
  for (const s of sources) {
    const due =
      !s.lastCheckedAt || now - new Date(s.lastCheckedAt).getTime() >= s.fetchIntervalSec * 1000;
    if (due) {
      await enqueueJob(prisma, {
        type: "fetch",
        dedupeKey: jobKeys.fetch(s.id),
        payload: { sourceId: s.id },
      });
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
      firstSeenAt: { gte: since },
      OR: [{ status: "classified", eventId: { not: null } }, { status: "ignored" }],
    },
    orderBy: { firstSeenAt: "desc" },
    take: env.reanalyzeBatch,
    select: { id: true },
  });
  const bucket = Math.floor(Date.now() / Math.max(1, env.reanalyzeIntervalMs));
  for (const s of signals) {
    await enqueueJob(prisma, {
      type: "reanalyze",
      dedupeKey: jobKeys.reanalyze(s.id, bucket),
      payload: { signalId: s.id },
    });
  }
}

export async function maintenanceTick(): Promise<void> {
  try {
    const removed = await cleanupFetchLogs();
    if (removed > 0) {
      console.log(`maintenance: 清理 ${removed} 条过期 FetchLog`);
    }
  } catch (e) {
    console.error("maintenance: FetchLog 清理失败", e);
  }
  try {
    if (await claimDailyRun("maintenance:heat-decay")) {
      const touched = await decayHeatScores();
      console.log(`maintenance: 热度每日衰减完成(${touched} 个事件)`);
    }
  } catch (e) {
    console.error("maintenance: 热度衰减失败", e);
  }
  try {
    const backup = await backupDatabase();
    if (backup) {
      console.log(`maintenance: 数据库已备份到 ${backup}`);
    }
  } catch (e) {
    console.error("maintenance: 数据库备份失败", e);
  }
}

export function startScheduler(): NodeJS.Timeout[] {
  tick().catch((e) => console.error("scheduler tick error", e));
  reanalyzeTick().catch((e) => console.error("reanalyze tick error", e));
  maintenanceTick().catch((e) => console.error("maintenance tick error", e));
  const fetchTimer = setInterval(() => {
    tick().catch((e) => console.error("scheduler tick error", e));
  }, env.schedulerIntervalMs);
  const reanalyzeTimer = setInterval(() => {
    reanalyzeTick().catch((e) => console.error("reanalyze tick error", e));
  }, env.reanalyzeIntervalMs);
  const maintenanceTimer = setInterval(() => {
    maintenanceTick().catch((e) => console.error("maintenance tick error", e));
  }, MAINTENANCE_INTERVAL_MS);
  return [fetchTimer, reanalyzeTimer, maintenanceTimer];
}
