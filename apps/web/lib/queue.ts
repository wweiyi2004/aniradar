import { configureDatabase, enqueueJob, jobKeys, prisma } from "@aniradar/db";

export async function enqueueFetch(sourceId: string) {
  await configureDatabase();
  return enqueueJob(prisma, {
    type: "fetch",
    dedupeKey: jobKeys.fetch(sourceId),
    payload: { sourceId },
  });
}
