import { randomUUID } from "node:crypto";
import {
  WORKER_LEASE_NAME,
  acquireLease,
  configureDatabase,
  prisma,
  recoverStaleJobs,
  releaseLease,
  renewLease,
} from "@aniradar/db";
import { env } from "@aniradar/config";
import { startScheduler } from "./scheduler";
import { startJobRunners } from "./jobRunner";

const LEASE_NAME = WORKER_LEASE_NAME;
const ownerId = `${process.pid}-${randomUUID()}`;

await configureDatabase();
if (!(await acquireLease(LEASE_NAME, ownerId, env.workerLeaseTtlMs))) {
  console.error("已有 AniRadar worker 持有运行租约，本进程退出。");
  await prisma.$disconnect();
  process.exit(1);
}

await recoverStaleJobs(env.jobLockTimeoutMs);
const runners = startJobRunners(ownerId);
const timers = startScheduler();
const staleTimer = setInterval(() => {
  recoverStaleJobs(env.jobLockTimeoutMs).catch((error) =>
    console.error("stale job recovery failed", error),
  );
}, 30_000);
let renewFailures = 0;
const leaseTimer = setInterval(
  async () => {
    try {
      if (!(await renewLease(LEASE_NAME, ownerId, env.workerLeaseTtlMs))) {
        console.error("worker 运行租约已丢失，准备退出。");
        await shutdown(1);
        return;
      }
      renewFailures = 0;
    } catch (error) {
      renewFailures += 1;
      console.error("worker lease renewal failed", error);
      // 连续失败接近 TTL 时退出，避免租约过期后本进程仍在跑、出现双 worker
      if (renewFailures >= 3) {
        console.error("worker lease renewal failed repeatedly，准备退出。");
        await shutdown(1);
      }
    }
  },
  Math.max(1000, Math.floor(env.workerLeaseTtlMs / 3)),
);

console.log("AniRadar SQLite worker started");

let shuttingDown = false;
async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  timers.forEach(clearInterval);
  clearInterval(staleTimer);
  clearInterval(leaseTimer);
  await runners.stop();
  await releaseLease(LEASE_NAME, ownerId).catch(() => undefined);
  await prisma.$disconnect();
  process.exit(exitCode);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
