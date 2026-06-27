import { Queue } from "bullmq";
import { redisConnection } from "@aniradar/config";
import { QUEUE_FETCH } from "@aniradar/shared";

let q: Queue | null = null;

export function getFetchQueue(): Queue {
  if (!q) q = new Queue(QUEUE_FETCH, { connection: redisConnection });
  return q;
}
