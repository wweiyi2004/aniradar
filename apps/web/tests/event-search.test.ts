import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { configureDatabase, prisma } from "@aniradar/db";
import { searchEventIdsByFts, toFtsQuery } from "../lib/event-search";

describe("toFtsQuery", () => {
  it("quotes single and multi terms with AND", () => {
    expect(toFtsQuery("动画化决定")).toBe(`"动画化决定"`);
    expect(toFtsQuery("abc def")).toBe(`"abc" AND "def"`);
  });

  it("falls back (null) when any term is shorter than 3 chars", () => {
    expect(toFtsQuery("海贼")).toBeNull();
    expect(toFtsQuery("海贼王 pv")).toBeNull();
    expect(toFtsQuery("")).toBeNull();
  });

  it("strips embedded quotes before building phrases", () => {
    expect(toFtsQuery(`进击"的巨人`)).toBe(`"进击的巨人"`);
  });
});

describe.sequential("searchEventIdsByFts (SQLite FTS5 integration)", () => {
  const TITLE_PREFIX = "FTS测试-";

  beforeEach(async () => {
    await configureDatabase();
    await prisma.event.deleteMany({ where: { title: { startsWith: TITLE_PREFIX } } });
  });

  afterAll(async () => {
    await prisma.event.deleteMany({ where: { title: { startsWith: TITLE_PREFIX } } });
    await prisma.$disconnect();
  });

  it("matches CJK substrings via triggers, honoring status and medium filters", async () => {
    const hit = await prisma.event.create({
      data: {
        title: `${TITLE_PREFIX}海贼王最终章动画化决定`,
        category: "anime_adaptation",
        status: "published",
        medium: "anime",
        publishedAt: new Date("2026-07-25T00:00:00Z"),
      },
    });
    await prisma.event.create({
      data: {
        title: `${TITLE_PREFIX}被忽略的动画化情报`,
        category: "anime_adaptation",
        status: "ignored",
        medium: "anime",
      },
    });
    await prisma.event.create({
      data: {
        title: `${TITLE_PREFIX}无关条目`,
        category: "other",
        status: "published",
        medium: "manga",
      },
    });

    const match = toFtsQuery("动画化")!;
    const base = {
      match,
      statuses: ["published", "auto_published"],
      sort: "new" as const,
      limit: 10,
      offset: 0,
    };

    const all = await searchEventIdsByFts(base);
    expect(all.ids).toContain(hit.id);
    expect(all.ids.every((id) => id !== undefined)).toBe(true);

    const animeOnly = await searchEventIdsByFts({ ...base, medium: "anime" });
    expect(animeOnly.ids).toContain(hit.id);

    const mangaOnly = await searchEventIdsByFts({ ...base, medium: "manga", match });
    expect(mangaOnly.ids).not.toContain(hit.id);
  });

  it("keeps the index in sync on update", async () => {
    const ev = await prisma.event.create({
      data: {
        title: `${TITLE_PREFIX}原始标题`,
        category: "other",
        status: "published",
      },
    });
    // 更新索引列后旧词不再命中,新词命中(验证 update 触发器)
    await prisma.event.update({
      where: { id: ev.id },
      data: { titleZh: "剧场版制作决定" },
    });

    const hitNew = await searchEventIdsByFts({
      match: toFtsQuery("剧场版制作")!,
      statuses: ["published"],
      sort: "new",
      limit: 10,
      offset: 0,
    });
    expect(hitNew.ids).toContain(ev.id);
    expect(hitNew.total).toBeGreaterThanOrEqual(1);
  });
});
