import { Worker } from "bullmq";
import { redisConnection } from "@aniradar/config";
import { QUEUE_FETCH, QUEUE_CLASSIFY, QUEUE_REANALYZE, QUEUE_COMPOSE } from "@aniradar/shared";
import { processFetch } from "./processFetch";
import { processClassify } from "./processClassify";
import { processReanalyze } from "./processReanalyze";
import { processCompose } from "./processCompose";
import { startScheduler } from "./scheduler";

const fetchWorker = new Worker(
  QUEUE_FETCH,
  async (job) =>
    processFetch(job.data, {
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts ?? 1,
    }),
  { connection: redisConnection, concurrency: 4 },
);
// 合并需读取既有 Event 再决定挂载/新建，并发设为 1 避免同主题信号竞态产生重复事件。
const classifyWorker = new Worker(
  QUEUE_CLASSIFY,
  async (job) =>
    processClassify(job.data, {
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts ?? 1,
    }),
  { connection: redisConnection, concurrency: 1 },
);
const reanalyzeWorker = new Worker(QUEUE_REANALYZE, async (job) => processReanalyze(job.data), {
  connection: redisConnection,
  concurrency: 1,
});
// 合成只写自身 Event 的 bodyZh，无合并竞态，并发可高于 classify。
const composeWorker = new Worker(QUEUE_COMPOSE, async (job) => processCompose(job.data), {
  connection: redisConnection,
  concurrency: 2,
});

fetchWorker.on("failed", (j, e) => console.error("fetch failed", j?.id, e?.message));
classifyWorker.on("failed", (j, e) => console.error("classify failed", j?.id, e?.message));
reanalyzeWorker.on("failed", (j, e) => console.error("reanalyze failed", j?.id, e?.message));
composeWorker.on("failed", (j, e) => console.error("compose failed", j?.id, e?.message));

const timers = startScheduler();
console.log("AniRadar worker started");

async function shutdown() {
  timers.forEach(clearInterval);
  await fetchWorker.close();
  await classifyWorker.close();
  await reanalyzeWorker.close();
  await composeWorker.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
