-- Deduplicate Source.url before unique index (keep oldest row per url).
DELETE FROM "Source"
WHERE "id" NOT IN (
  SELECT MIN("id") FROM "Source" GROUP BY "url"
);

CREATE UNIQUE INDEX "Source_url_key" ON "Source"("url");
CREATE INDEX "Signal_eventId_idx" ON "Signal"("eventId");
CREATE INDEX "Event_status_publishedAt_idx" ON "Event"("status", "publishedAt");
CREATE INDEX "Event_workKey_firstSeenAt_idx" ON "Event"("workKey", "firstSeenAt");
