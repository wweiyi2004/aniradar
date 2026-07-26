import { prisma } from "@aniradar/db";
import { env } from "@aniradar/config";

const DAY_MS = 24 * 60 * 60 * 1000;

/** 删除超过保留窗口(FETCH_LOG_RETENTION_DAYS,默认 30 天)的 FetchLog,返回删除条数。 */
export async function cleanupFetchLogs(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - env.fetchLogRetentionDays * DAY_MS);
  const result = await prisma.fetchLog.deleteMany({
    where: { startedAt: { lt: cutoff } },
  });
  return result.count;
}
