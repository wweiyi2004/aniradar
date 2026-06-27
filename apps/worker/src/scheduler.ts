import { prisma } from "@aniradar/db";
import { env } from "@aniradar/config";
import { fetchQueue } from "./queues";

export async function tick(): Promise<void> {
  const now = Date.now();
  const sources = await prisma.source.findMany({ where: { enabled: true } });
  for (const s of sources) {
    const due =
      !s.lastCheckedAt || now - new Date(s.lastCheckedAt).getTime() >= s.fetchIntervalSec * 1000;
    if (due) {
      await fetchQueue.add("fetch", { sourceId: s.id }, { removeOnComplete: 100, removeOnFail: 100 });
    }
  }
}

export function startScheduler(): NodeJS.Timeout {
  tick().catch((e) => console.error("scheduler tick error", e));
  return setInterval(() => {
    tick().catch((e) => console.error("scheduler tick error", e));
  }, env.schedulerIntervalMs);
}
