import { prisma } from "@aniradar/db";
import { composeQueue } from "./queues";

// 一次性：给所有“已分类、可见、尚无 bodyZh”的事件入队合成。运行中的 worker 会逐个处理。
async function main() {
  const events = await prisma.event.findMany({
    where: {
      status: { in: ["auto_published", "published", "draft_ai"] },
      bodyZh: null,
    },
    select: { id: true },
  });
  for (const e of events) {
    await composeQueue.add("compose", { eventId: e.id });
  }
  console.log(`enqueued compose for ${events.length} events`);
  process.exit(0);
}

main();
