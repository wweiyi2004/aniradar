import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { configureDatabase, prisma } from "@aniradar/db";
import { cleanupFetchLogs } from "../src/maintenance";

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
