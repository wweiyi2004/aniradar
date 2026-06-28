import { prisma } from "@aniradar/db";
import { isSameEvent } from "@aniradar/detector";
import { mergeFacts } from "./facts";
import { composeQueue } from "./queues";

// 一次性清理：按新版 isSameEvent 把"同作品同分类、窗口内"的历史重复事件合并到最早的那个。
// 默认 dry-run，只打印合并计划；设 APPLY=1 才真正执行。
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 历史清理放宽到 7 天
const APPLY = process.env.APPLY === "1";

async function main() {
  const events = await prisma.event.findMany({
    where: { status: { in: ["auto_published", "published", "draft_ai"] } },
    orderBy: { firstSeenAt: "asc" },
  });

  // 贪心聚类：每个事件找一个已有 primary（同分类、窗口内、isSameEvent）合并，否则自成 primary。
  const primaries: typeof events = [];
  const merges: { from: (typeof events)[number]; into: (typeof events)[number] }[] = [];
  for (const ev of events) {
    const target = primaries.find(
      (p) =>
        Math.abs(p.firstSeenAt.getTime() - ev.firstSeenAt.getTime()) <= WINDOW_MS &&
        isSameEvent(
          { title: p.title, category: p.category },
          { title: ev.title, category: ev.category },
        ),
    );
    if (target) merges.push({ from: ev, into: target });
    else primaries.push(ev);
  }

  console.log(`events=${events.length} primaries=${primaries.length} merges=${merges.length}  APPLY=${APPLY}`);
  for (const { from, into } of merges) {
    console.log(`  [${from.category}] "${from.titleZh ?? from.title}"\n      -> "${into.titleZh ?? into.title}"`);
  }
  if (!APPLY) {
    console.log("\n(dry-run：未改动。确认无误后用 APPLY=1 再跑一次执行。)");
    process.exit(0);
  }

  for (const { from, into } of merges) {
    // 每次重新读取 primary，避免多条合并到同一 primary 时内存值过期。
    const cur = await prisma.event.findUnique({ where: { id: into.id } });
    if (!cur) continue;
    const earlier =
      cur.publishedAt && from.publishedAt && from.publishedAt < cur.publishedAt
        ? from.publishedAt
        : (cur.publishedAt ?? from.publishedAt);
    await prisma.$transaction(async (tx) => {
      await tx.signal.updateMany({ where: { eventId: from.id }, data: { eventId: into.id } });
      await tx.event.update({
        where: { id: into.id },
        data: {
          heatScore: { increment: from.heatScore },
          publishedAt: earlier,
          medium: cur.medium ?? from.medium,
          facts: mergeFacts(cur.facts, (from.facts ?? {}) as Record<string, unknown>) as object,
          imageUrl: cur.imageUrl ?? from.imageUrl,
          videoUrl: cur.videoUrl ?? from.videoUrl,
          officialConfirmed: cur.officialConfirmed || from.officialConfirmed,
        },
      });
      await tx.event.update({ where: { id: from.id }, data: { status: "merged" } });
    });
    await composeQueue.add("compose", { eventId: into.id }); // 重新合成 primary 正文
  }
  console.log(`dedupe done: merged ${merges.length} events`);
  process.exit(0);
}

main();
