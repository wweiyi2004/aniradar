import { Queue } from "bullmq";
import { redisConnection } from "@aniradar/config";
import { QUEUE_FETCH, QUEUE_CLASSIFY } from "@aniradar/shared";

export const fetchQueue = new Queue(QUEUE_FETCH, { connection: redisConnection });
export const classifyQueue = new Queue(QUEUE_CLASSIFY, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 500,
    removeOnFail: 500,
  },
});
