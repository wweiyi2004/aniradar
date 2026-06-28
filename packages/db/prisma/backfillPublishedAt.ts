import { prisma } from "../src/index";

// 给现有 Event 回填 publishedAt = 关联 signal 中最早的 (publishedAt ?? firstSeenAt)。
// 无关联 signal 时回退事件自身 firstSeenAt。一次性脚本（无 AI key 也可跑）。
async function main() {
  const events = await prisma.event.findMany({
    select: {
      id: true,
      firstSeenAt: true,
      signals: { select: { publishedAt: true, firstSeenAt: true } },
    },
  });
  let n = 0;
  for (const e of events) {
    const times = e.signals.map((s) => (s.publishedAt ?? s.firstSeenAt).getTime());
    const pub = times.length ? new Date(Math.min(...times)) : e.firstSeenAt;
    await prisma.event.update({ where: { id: e.id }, data: { publishedAt: pub } });
    n++;
  }
  console.log(`backfilled publishedAt for ${n} events`);
  await prisma.$disconnect();
}

main();
