import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { configureDatabase, prisma } from "@aniradar/db";
import { backupDatabase, cleanupFetchLogs } from "../src/maintenance";

const TEST_SOURCE_URL = "https://example.com/maintenance-test";

describe.sequential("maintenance: cleanupFetchLogs", () => {
  beforeEach(async () => {
    await configureDatabase();
    // 只清理本测试的数据,避免影响并行测试文件
    await prisma.source.deleteMany({ where: { url: TEST_SOURCE_URL } });
  });

  afterAll(async () => {
    await prisma.source.deleteMany({ where: { url: TEST_SOURCE_URL } });
    await prisma.$disconnect();
  });

  it("removes logs older than the retention window, keeps recent ones", async () => {
    const source = await prisma.source.create({
      data: {
        name: "维护测试源",
        url: TEST_SOURCE_URL,
        type: "official_news",
        fetchStrategy: "rss",
      },
    });
    const now = new Date("2026-07-26T00:00:00Z");
    // 默认保留 30 天:40 天前应删,5 天前应留。
    await prisma.fetchLog.createMany({
      data: [
        {
          sourceId: source.id,
          status: "success",
          startedAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
        },
        {
          sourceId: source.id,
          status: "failed",
          startedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        },
      ],
    });

    const removed = await cleanupFetchLogs(now);

    expect(removed).toBeGreaterThanOrEqual(1);
    const left = await prisma.fetchLog.findMany({
      where: { sourceId: source.id },
    });
    expect(left).toHaveLength(1);
    expect(left[0].status).toBe("failed");
  });

  it("is a no-op when everything is inside the window", async () => {
    const source = await prisma.source.create({
      data: {
        name: "维护测试源",
        url: TEST_SOURCE_URL,
        type: "official_news",
        fetchStrategy: "rss",
      },
    });
    const now = new Date("2026-07-26T00:00:00Z");
    await prisma.fetchLog.create({
      data: { sourceId: source.id, status: "success", startedAt: now },
    });

    await cleanupFetchLogs(now);

    const left = await prisma.fetchLog.count({
      where: { sourceId: source.id },
    });
    expect(left).toBe(1);
  });
});

describe.sequential("maintenance: backupDatabase", () => {
  // 独立目录,避免碰真实 data/backups/
  const dir = path.join(process.cwd(), "data", "test-backups");

  beforeEach(async () => {
    await configureDatabase();
    await rm(dir, { recursive: true, force: true });
    delete process.env.BACKUP_KEEP;
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
    delete process.env.BACKUP_KEEP;
    await prisma.$disconnect();
  });

  it("creates a valid SQLite backup, at most one per day", async () => {
    // 两个时刻在 UTC 与 UTC+8 都属于同一天,避免时区导致判定漂移。
    const first = await backupDatabase(new Date("2026-07-26T08:00:00Z"), dir);
    expect(first).not.toBeNull();
    const head = await readFile(first!);
    expect(head.subarray(0, 15).toString("latin1")).toBe("SQLite format 3");

    const again = await backupDatabase(new Date("2026-07-26T10:00:00Z"), dir);
    expect(again).toBeNull();
    expect(await readdir(dir)).toHaveLength(1);
  });

  it("rotates old backups beyond BACKUP_KEEP", async () => {
    process.env.BACKUP_KEEP = "2";
    await backupDatabase(new Date("2026-07-01T02:00:00Z"), dir);
    await backupDatabase(new Date("2026-07-02T02:00:00Z"), dir);
    await backupDatabase(new Date("2026-07-03T02:00:00Z"), dir);

    const files = (await readdir(dir)).sort();
    expect(files).toHaveLength(2);
    expect(files.some((f) => f.includes("20260701"))).toBe(false);
  });

  it("is disabled when BACKUP_KEEP=0", async () => {
    process.env.BACKUP_KEEP = "0";
    const out = await backupDatabase(new Date("2026-07-26T08:00:00Z"), dir);
    expect(out).toBeNull();
  });
});
