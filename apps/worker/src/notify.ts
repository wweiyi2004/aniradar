import { prisma } from "@aniradar/db";
import { env } from "@aniradar/config";
import { publicEventStatuses } from "@aniradar/shared";

// 只推送新鲜事件:首次启用或长时间停机后,超龄事件直接标记跳过,避免轰炸。
const NOTIFY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// 每轮限量,配合 60s tick 自然限流。
const NOTIFY_BATCH = 20;

export interface NotifiableEvent {
  id: string;
  title: string;
  titleZh: string | null;
  summaryZh: string | null;
  category: string;
  publishedAt: Date | null;
  firstSeenAt: Date;
}

export interface NotifyPayload {
  eventId: string;
  title: string;
  url: string;
  category: string;
  summary: string | null;
}

export type NotificationSender = (text: string, payload: NotifyPayload) => Promise<void>;

export function isNotifyConfigured(): boolean {
  return !!(env.notifyWebhookUrl || (env.telegramBotToken && env.telegramChatId));
}

export function formatNotificationText(e: NotifiableEvent, url: string): string {
  const title = e.titleZh?.trim() || e.title;
  const lines = [`📡 ${title}`];
  if (e.summaryZh?.trim()) {
    const summary = e.summaryZh.trim();
    lines.push(summary.length > 140 ? `${summary.slice(0, 140)}…` : summary);
  }
  lines.push(url);
  return lines.join("\n");
}

async function assertOk(res: Response, channel: string): Promise<void> {
  if (!res.ok) {
    throw new Error(`${channel} 推送失败: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}

/** 默认发送器:通用 Webhook(POST JSON)与 Telegram sendMessage,配置了哪个发哪个。 */
export const defaultSender: NotificationSender = async (text, payload) => {
  const tasks: Promise<void>[] = [];
  if (env.notifyWebhookUrl) {
    tasks.push(
      fetch(env.notifyWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, ...payload }),
      }).then((res) => assertOk(res, "webhook")),
    );
  }
  if (env.telegramBotToken && env.telegramChatId) {
    tasks.push(
      fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: env.telegramChatId, text }),
      }).then((res) => assertOk(res, "telegram")),
    );
  }
  await Promise.all(tasks);
};

/**
 * 推送新公开事件(notifiedAt 为空的 published/auto_published):
 * 超龄的标记跳过;发送成功才推进水位,渠道故障时本轮止损、下轮重试。
 */
export async function notifyTick(
  sender: NotificationSender = defaultSender,
  now = new Date(),
): Promise<{ sent: number; skipped: number }> {
  if (!isNotifyConfigured()) return { sent: 0, skipped: 0 };
  const visible = publicEventStatuses(false);
  const pending = await prisma.event.findMany({
    where: { status: { in: [...visible] }, notifiedAt: null },
    orderBy: { firstSeenAt: "asc" },
    take: NOTIFY_BATCH,
    select: {
      id: true,
      title: true,
      titleZh: true,
      summaryZh: true,
      category: true,
      publishedAt: true,
      firstSeenAt: true,
    },
  });

  const origin = env.publicOrigin ?? "http://localhost:3000";
  let sent = 0;
  let skipped = 0;
  for (const e of pending) {
    const born = (e.publishedAt ?? e.firstSeenAt).getTime();
    if (now.getTime() - born > NOTIFY_MAX_AGE_MS) {
      await prisma.event.update({ where: { id: e.id }, data: { notifiedAt: now } });
      skipped++;
      continue;
    }
    const url = `${origin}/events/${e.id}`;
    try {
      await sender(formatNotificationText(e, url), {
        eventId: e.id,
        title: e.titleZh?.trim() || e.title,
        url,
        category: e.category,
        summary: e.summaryZh,
      });
    } catch (error) {
      console.error(`notify: 推送失败(${e.id}),本轮止损`, error);
      break;
    }
    await prisma.event.update({ where: { id: e.id }, data: { notifiedAt: now } });
    sent++;
  }
  return { sent, skipped };
}
