import { prisma } from "../src/index";
import { mediumFromCategory } from "@aniradar/shared";

// 给 medium 为空的 Event 按 category 规则补一个兜底 medium（facts 留空）。
// 用于无 AI key 时让历史/新事件也能进对应板块。
async function main() {
  const events = await prisma.event.findMany({ where: { medium: null }, select: { id: true, category: true } });
  let n = 0;
  for (const e of events) {
    await prisma.event.update({ where: { id: e.id }, data: { medium: mediumFromCategory(e.category) } });
    n++;
  }
  console.log(`backfilled medium for ${n} events`);
  await prisma.$disconnect();
}
main();
