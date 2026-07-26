import { copyFile, rm, stat } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg, { type QueryResultRow } from "pg";
import type { Prisma } from "@prisma/client";
import { configureDatabase, enqueueJob, jobKeys, prisma } from "../src/index";
import { prepareEventRow, prepareSourceRow } from "./importTransform";

const { Client, types } = pg;
const BATCH = 500;
const FORCE = process.argv.includes("--force");

// Prisma/PostgreSQL 的 DateTime 是无时区 TIMESTAMP，但其内容按 UTC 解释。
types.setTypeParser(1114, (value) => new Date(`${value}Z`));

function targetPath(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) throw new Error("DATABASE_URL 必须是 file: SQLite URL");
  const raw = decodeURIComponent(url.slice("file:".length));
  return isAbsolute(raw) ? raw : resolve(dirname(fileURLToPath(import.meta.url)), raw);
}

function backupName(path: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${path}.${stamp}.bak`;
}

async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function readBatches<T extends QueryResultRow>(
  source: InstanceType<typeof Client>,
  table: string,
  consume: (rows: T[]) => Promise<void>,
): Promise<number> {
  let offset = 0;
  let total = 0;
  while (true) {
    const result = await source.query<T>(
      `SELECT * FROM "${table}" ORDER BY "createdAt", "id" LIMIT $1 OFFSET $2`,
      [BATCH, offset],
    );
    if (result.rows.length === 0) break;
    await consume(result.rows);
    total += result.rows.length;
    offset += result.rows.length;
    console.log(`  ${table}: ${total}`);
  }
  return total;
}

async function main() {
  const sourceUrl = process.env.POSTGRES_SOURCE_URL?.trim();
  if (!sourceUrl) throw new Error("请设置 POSTGRES_SOURCE_URL 后再执行导入");

  const sqlite = targetPath();
  await configureDatabase();
  const existingRows = await Promise.all([
    prisma.source.count(),
    prisma.event.count(),
    prisma.signal.count(),
    prisma.fetchLog.count(),
  ]).then((counts) => counts.reduce((sum, value) => sum + value, 0));
  if (existingRows > 0 && !FORCE) {
    throw new Error("目标 SQLite 非空；确认 Web/Worker 已停止后使用 --force（会先自动备份）");
  }

  let backup: string | null = null;
  if (await exists(sqlite)) {
    await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");
    backup = backupName(sqlite);
    await copyFile(sqlite, backup);
    console.log(`SQLite 备份: ${backup}`);
  }

  const source = new Client({ connectionString: sourceUrl });
  await source.connect();
  await source.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");

  try {
    await configureDatabase();
    await prisma.$transaction([
      prisma.job.deleteMany(),
      prisma.runtimeLease.deleteMany(),
      prisma.fetchLog.deleteMany(),
      prisma.signal.deleteMany(),
      prisma.event.deleteMany(),
      prisma.source.deleteMany(),
    ]);

    const counts: Record<string, number> = {};
    counts.Source = await readBatches<Record<string, unknown>>(source, "Source", async (rows) => {
      await prisma.source.createMany({ data: rows.map(prepareSourceRow) });
    });
    counts.Event = await readBatches<Record<string, unknown>>(source, "Event", async (rows) => {
      await prisma.event.createMany({ data: rows.map(prepareEventRow) });
    });
    counts.Signal = await readBatches<Prisma.SignalCreateManyInput>(
      source,
      "Signal",
      async (rows) => {
        await prisma.signal.createMany({ data: rows });
      },
    );
    counts.FetchLog = await readBatches<Prisma.FetchLogCreateManyInput>(
      source,
      "FetchLog",
      async (rows) => {
        await prisma.fetchLog.createMany({ data: rows });
      },
    );

    const rawSignals = await prisma.signal.findMany({
      where: { status: "raw" },
      select: { id: true },
    });
    for (const signal of rawSignals) {
      await enqueueJob(prisma, {
        type: "classify",
        dedupeKey: jobKeys.classify(signal.id),
        payload: { signalId: signal.id },
      });
    }
    const uncomposed = await prisma.event.findMany({
      where: {
        bodyZh: null,
        status: { notIn: ["ignored", "retracted", "merged"] },
        signals: { some: { status: "classified" } },
      },
      select: {
        id: true,
        signals: { where: { status: "classified" }, take: 1, select: { id: true } },
      },
    });
    for (const event of uncomposed) {
      const signalId = event.signals[0]?.id;
      if (!signalId) continue;
      await enqueueJob(prisma, {
        type: "compose",
        dedupeKey: jobKeys.compose(event.id, signalId),
        payload: { eventId: event.id },
      });
    }

    const targetCounts = {
      Source: await prisma.source.count(),
      Event: await prisma.event.count(),
      Signal: await prisma.signal.count(),
      FetchLog: await prisma.fetchLog.count(),
    };
    for (const name of Object.keys(counts)) {
      if (counts[name] !== targetCounts[name as keyof typeof targetCounts]) {
        throw new Error(
          `${name} 计数不一致: source=${counts[name]} target=${targetCounts[name as keyof typeof targetCounts]}`,
        );
      }
    }
    const orphanRows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) AS count FROM "Signal" s LEFT JOIN "Source" src ON src.id=s.sourceId LEFT JOIN "Event" e ON e.id=s.eventId WHERE src.id IS NULL OR (s.eventId IS NOT NULL AND e.id IS NULL)`,
    );
    if (Number(orphanRows[0]?.count ?? 0) !== 0) throw new Error("迁移后存在孤立 Signal 外键");

    await source.query("COMMIT");
    console.log("PostgreSQL → SQLite 导入完成", targetCounts);
    if (backup) console.log(`确认数据无误后可手动删除备份：${backup}`);
  } catch (error) {
    await source.query("ROLLBACK").catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
    if (backup) {
      await rm(`${sqlite}-wal`, { force: true });
      await rm(`${sqlite}-shm`, { force: true });
      await copyFile(backup, sqlite);
      console.error(`导入失败，已恢复 SQLite 备份：${backup}`);
    }
    throw error;
  } finally {
    await source.end();
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
