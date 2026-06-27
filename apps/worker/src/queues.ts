import { Queue } from "bullmq";
import { redisConnection } from "@aniradar/config";
import { QUEUE_FETCH, QUEUE_CLASSIFY, QUEUE_REANALYZE } from "@aniradar/shared";

export const fetchQueue = new Queue(QUEUE_FETCH, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});
export const classifyQueue = new Queue(QUEUE_CLASSIFY, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 500,
    removeOnFail: 500,
  },
});
export const reanalyzeQueue = new Queue(QUEUE_REANALYZE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 200,
    removeOnFail: 200,
  },
});
