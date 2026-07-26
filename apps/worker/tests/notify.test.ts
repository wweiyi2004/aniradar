import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { configureDatabase, prisma } from "@aniradar/db";
import { formatNotificationText, notifyTick, type NotifyPayload } from "../src/notify";

const TITLE_PREFIX = "推送测试事件-";

function mkEvent(
  suffix: string,
  status: "published" | "auto_published" | "draft_ai",
  publishedAt: Date,
) {
  return prisma.event.create({
    data: {
      title: `${TITLE_PREFIX}${suffix}`,
      titleZh: `${TITLE_PREFIX}${suffix}译`,
      summaryZh: "测试摘要",
      category: "other",
      status,
      publishedAt,
    },
  });
}

describe.sequential("notify", () => {
  beforeEach(async () => {
    await configureDatabase();
    await prisma.event.deleteMany({ where: { title: { startsWith: TITLE_PREFIX } } });
    delete process.env.NOTIFY_WEBHOOK_URL;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  afterAll(async () => {
    await prisma.event.deleteMany({ where: { title: { startsWith: TITLE_PREFIX } } });
    delete process.env.NOTIFY_WEBHOOK_URL;
    await prisma.$disconnect();
  });

  it("does nothing when no channel is configured", async () => {
    const now = new Date();
    await mkEvent("未配置", "published", now);
    const sends: string[] = [];
    const result = await notifyTick(async (text) => {
      sends.push(text);
    }, now);
    expect(result).toEqual({ sent: 0, skipped: 0 });
    expect(sends).toHaveLength(0);
  });

  it("sends fresh visible events, skips stale ones, ignores drafts", async () => {
    process.env.NOTIFY_WEBHOOK_URL = "https://example.com/hook";
    const now = new Date("2026-07-26T12:00:00Z");
    const fresh = await mkEvent("新", "published", new Date("2026-07-26T10:00:00Z"));
    const stale = await mkEvent("旧", "auto_published", new Date("2026-07-20T10:00:00Z"));
    const draft = await mkEvent("草稿", "draft_ai", new Date("2026-07-26T10:00:00Z"));

    const payloads: NotifyPayload[] = [];
    const result = await notifyTick(async (_text, payload) => {
      payloads.push(payload);
    }, now);

    expect(result).toEqual({ sent: 1, skipped: 1 });
    expect(payloads).toHaveLength(1);
    expect(payloads[0].eventId).toBe(fresh.id);
    expect(payloads[0].url).toContain(`/events/${fresh.id}`);

    const [freshAfter, staleAfter, draftAfter] = await Promise.all([
      prisma.event.findUniqueOrThrow({ where: { id: fresh.id } }),
      prisma.event.findUniqueOrThrow({ where: { id: stale.id } }),
      prisma.event.findUniqueOrThrow({ where: { id: draft.id } }),
    ]);
    expect(freshAfter.notifiedAt).not.toBeNull();
    expect(staleAfter.notifiedAt).not.toBeNull();
    expect(draftAfter.notifiedAt).toBeNull();

    // 第二轮:全部已有水位,不再重复推送。
    const again = await notifyTick(async () => {
      throw new Error("不应再发送");
    }, now);
    expect(again).toEqual({ sent: 0, skipped: 0 });
  });

  it("keeps watermark untouched when the sender fails", async () => {
    process.env.NOTIFY_WEBHOOK_URL = "https://example.com/hook";
    const now = new Date("2026-07-26T12:00:00Z");
    const ev = await mkEvent("失败", "published", new Date("2026-07-26T11:00:00Z"));

    const result = await notifyTick(async () => {
      throw new Error("渠道故障");
    }, now);

    expect(result).toEqual({ sent: 0, skipped: 0 });
    const after = await prisma.event.findUniqueOrThrow({ where: { id: ev.id } });
    expect(after.notifiedAt).toBeNull();
  });

  it("formats notification text with title, summary and url", () => {
    const text = formatNotificationText(
      {
        id: "e1",
        title: "raw title",
        titleZh: "中文标题",
        summaryZh: "一句话摘要",
        category: "pv_released",
        publishedAt: null,
        firstSeenAt: new Date(),
      },
      "https://example.com/events/e1",
    );
    expect(text).toContain("中文标题");
    expect(text).toContain("一句话摘要");
    expect(text).toContain("https://example.com/events/e1");
  });
});
