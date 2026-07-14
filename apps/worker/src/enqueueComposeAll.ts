import { enqueueJob, jobKeys, prisma } from "@aniradar/db";

// 一次性：给所有“已分类、可见、尚无 bodyZh”的事件入队合成。运行中的 worker 会逐个处理。
// FORCE=1 时忽略"尚无 bodyZh"条件，对全部可见事件重新合成（用于 compose prompt 升级后回填）。
const FORCE = process.env.FORCE === "1";

async function main() {
  const events = await prisma.event.findMany({
    where: {
      status: { in: ["auto_published", "published", "draft_ai"] },
      ...(FORCE ? {} : { bodyZh: null }),
    },
    select: { id: true },
  });
  for (const e of events) {
    await enqueueJob(prisma, {
      type: "compose",
      dedupeKey: jobKeys.compose(e.id, `bulk-${Date.now()}`),
      payload: { eventId: e.id },
    });
  }
  console.log(`enqueued compose for ${events.length} events`);
  process.exit(0);
}

main();
