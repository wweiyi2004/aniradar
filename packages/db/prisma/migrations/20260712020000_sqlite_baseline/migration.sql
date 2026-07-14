CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'B',
    "fetchStrategy" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "fetchIntervalSec" INTEGER NOT NULL DEFAULT 900,
    "lastCheckedAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "etag" TEXT,
    "lastModified" TEXT,
    "lastSeenHash" TEXT,
    "selectorConfig" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Signal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleZh" TEXT,
    "url" TEXT NOT NULL,
    "rawText" TEXT,
    "summary" TEXT,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "aiSource" TEXT,
    "publishedAt" DATETIME,
    "publishedTimePrecision" TEXT NOT NULL DEFAULT 'unknown',
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hash" TEXT NOT NULL,
    "language" TEXT,
    "status" TEXT NOT NULL DEFAULT 'raw',
    "eventId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Signal_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Signal_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "titleZh" TEXT,
    "summaryZh" TEXT,
    "bodyZh" TEXT,
    "medium" TEXT,
    "facts" JSONB,
    "workKey" TEXT,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "category" TEXT NOT NULL,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    "confidence" REAL NOT NULL DEFAULT 0,
    "heatScore" REAL NOT NULL DEFAULT 0,
    "officialConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft_ai',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "FetchLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    CONSTRAINT "FetchLog_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "runAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL,
    "lockedAt" DATETIME,
    "lockedBy" TEXT,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "RuntimeLease" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "Signal_hash_key" ON "Signal"("hash");
CREATE INDEX "Signal_sourceId_idx" ON "Signal"("sourceId");
CREATE INDEX "Signal_status_idx" ON "Signal"("status");
CREATE INDEX "Event_status_idx" ON "Event"("status");
CREATE INDEX "Event_category_idx" ON "Event"("category");
CREATE INDEX "Event_firstSeenAt_idx" ON "Event"("firstSeenAt");
CREATE INDEX "Event_publishedAt_idx" ON "Event"("publishedAt");
CREATE INDEX "Event_workKey_idx" ON "Event"("workKey");
CREATE INDEX "FetchLog_sourceId_idx" ON "FetchLog"("sourceId");
CREATE UNIQUE INDEX "Job_dedupeKey_key" ON "Job"("dedupeKey");
CREATE INDEX "Job_type_status_runAt_idx" ON "Job"("type", "status", "runAt");
CREATE INDEX "Job_status_lockedAt_idx" ON "Job"("status", "lockedAt");
