import { Worker } from "bullmq";
import { redisConnection } from "@aniradar/config";
import { QUEUE_FETCH, QUEUE_CLASSIFY } from "@aniradar/shared";
import { processFetch } from "./processFetch";
import { processClassify } from "./processClassify";
import { startScheduler } from "./scheduler";

const fetchWorker = new Worker(QUEUE_FETCH, async (job) => processFetch(job.data), {
  connection: redisConnection,
  concurrency: 4,
});
// 合并需读取既有 Event 再决定挂载/新建，并发设为 1 避免同主题信号竞态产生重复事件。
const classifyWorker = new Worker(QUEUE_CLASSIFY, async (job) => processClassify(job.data), {
  connection: redisConnection,
  concurrency: 1,
});

fetchWorker.on("failed", (j, e) => console.error("fetch failed", j?.id, e?.message));
classifyWorker.on("failed", (j, e) => console.error("classify failed", j?.id, e?.message));

const timer = startScheduler();
console.log("AniRadar worker started");

async function shutdown() {
  clearInterval(timer);
  await fetchWorker.close();
  await classifyWorker.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
