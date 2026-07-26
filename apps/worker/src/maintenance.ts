import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
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

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// 本地时间戳:备份文件名给人看,与"每日一份"的判断保持同一时区。
function formatStamp(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * SQLite 在线备份:VACUUM INTO 到数据库同目录 backups/(测试可注入 targetDir)。
 * 每日至多一份;滚动保留 BACKUP_KEEP 份(0 = 禁用)。
 * 返回新备份文件路径;跳过(已备份/禁用)返回 null。
 */
export async function backupDatabase(
  now = new Date(),
  targetDir?: string,
): Promise<string | null> {
  const keep = env.backupKeep;
  if (keep <= 0) return null;
  // 主库文件绝对路径由 SQLite 自己给出,免去解析 DATABASE_URL 相对路径。
  const rows = await prisma.$queryRawUnsafe<Array<{ file: string }>>(
    "SELECT file FROM pragma_database_list WHERE name = 'main'",
  );
  const dbFile = rows[0]?.file;
  if (!dbFile) return null;

  const prefix = path.basename(dbFile).replace(/\.db$/, "");
  const dir = targetDir ?? path.join(path.dirname(dbFile), "backups");
  await mkdir(dir, { recursive: true });

  // 只滚动清理自己前缀的备份,test 库与主库共存于同一目录也互不干扰。
  const pattern = new RegExp(`^${escapeRegExp(prefix)}-\\d{8}-\\d{6}\\.db$`);
  const existing = (await readdir(dir)).filter((f) => pattern.test(f)).sort();
  const stamp = formatStamp(now);
  if (existing.some((f) => f.startsWith(`${prefix}-${stamp.slice(0, 8)}`))) {
    return null;
  }

  const fileName = `${prefix}-${stamp}.db`;
  const target = path.join(dir, fileName);
  await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);

  const all = [...existing, fileName].sort();
  const excess = all.slice(0, Math.max(0, all.length - keep));
  for (const f of excess) {
    await rm(path.join(dir, f), { force: true });
  }
  return target;
}
