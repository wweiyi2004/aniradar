import type { Job, JobType } from "@aniradar/db";
import { claimJob, completeJob, heartbeatJob, retryOrFailJob } from "@aniradar/db";
import { env } from "@aniradar/config";
import { processFetch } from "./processFetch";
import { processClassify } from "./processClassify";
import { processReanalyze } from "./processReanalyze";
import { processCompose } from "./processCompose";

const CONCURRENCY: Record<JobType, number> = { fetch: 4, classify: 1, reanalyze: 1, compose: 1 };
const HEARTBEAT_MS = Math.max(5_000, Math.floor(env.jobLockTimeoutMs / 3));

function payloadString(job: Job, field: string): string {
  const payload = job.payload;
  const value = payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)[field]
    : undefined;
  if (typeof value !== "string" || !value) throw new Error(`invalid ${job.type} payload: ${field}`);
  return value;
}

async function handle(job: Job): Promise<void> {
  const retry = { attemptsMade: job.attempts - 1, maxAttempts: job.maxAttempts };
  switch (job.type) {
    case "fetch":
      return processFetch({ sourceId: payloadString(job, "sourceId") }, retry);
    case "classify":
      return processClassify({ signalId: payloadString(job, "signalId") }, retry);
    case "reanalyze":
      return processReanalyze({ signalId: payloadString(job, "signalId") });
    case "compose":
      return processCompose({ eventId: payloadString(job, "eventId") });
  }
}

export function startJobRunners(workerId: string): { stop(): Promise<void> } {
  let stopping = false;
  const wait = () => new Promise((resolve) => setTimeout(resolve, env.jobPollIntervalMs));

  async function loop(type: JobType, slot: number): Promise<void> {
    const runnerId = `${workerId}-${type}-${slot}`;
    while (!stopping) {
      let job: Job | null = null;
      try {
        job = await claimJob(type, runnerId);
        if (!job) {
          await wait();
          continue;
        }
        const beat = setInterval(() => {
          heartbeatJob(job!.id, runnerId).catch((error) => {
            console.error(`${type} job heartbeat failed`, job?.id, error);
          });
        }, HEARTBEAT_MS);
        try {
          await handle(job);
          const done = await completeJob(job.id, runnerId);
          if (!done) console.error(`${type} job complete lost ownership`, job.id);
        } finally {
          clearInterval(beat);
        }
      } catch (error) {
        if (job) {
          let status: "pending" | "failed" | "lost" = "lost";
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              status = await retryOrFailJob(job, runnerId, error);
              break;
            } catch (settleError) {
              console.error(`${type} job settle failed`, job.id, settleError);
              await wait();
            }
          }
          console.error(`${type} job ${status}`, job.id, error instanceof Error ? error.message : error);
        } else {
          console.error(`${type} runner failed`, error);
          await wait();
        }
      }
    }
  }

  const loops = (Object.keys(CONCURRENCY) as JobType[]).flatMap((type) =>
    Array.from({ length: CONCURRENCY[type] }, (_, slot) => loop(type, slot)),
  );

  return {
    async stop() {
      stopping = true;
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, 15_000));
      await Promise.race([Promise.all(loops), timeout]);
    },
  };
}
