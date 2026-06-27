-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('official_news', 'youtube_rss', 'press', 'media', 'company_news', 'publisher_news');

-- CreateEnum
CREATE TYPE "SourceLevel" AS ENUM ('S', 'A', 'B', 'C');

-- CreateEnum
CREATE TYPE "FetchStrategy" AS ENUM ('rss', 'youtube_rss', 'html_list', 'page_diff');

-- CreateEnum
CREATE TYPE "PublishedTimePrecision" AS ENUM ('datetime', 'date_only', 'unknown');

-- CreateEnum
CREATE TYPE "SignalStatus" AS ENUM ('raw', 'classified', 'ignored', 'merged', 'failed');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('anime_adaptation', 'sequel_announced', 'pv_released', 'key_visual_released', 'cast_announced', 'staff_announced', 'broadcast_date_announced', 'delay_announced', 'movie_announced', 'theme_song_announced', 'event_info', 'merch_release', 'bd_release', 'other');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('draft_ai', 'auto_published', 'published', 'needs_review', 'ignored', 'merged', 'retracted');

-- CreateEnum
CREATE TYPE "FetchLogStatus" AS ENUM ('success', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "level" "SourceLevel" NOT NULL DEFAULT 'B',
    "fetchStrategy" "FetchStrategy" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "fetchIntervalSec" INTEGER NOT NULL DEFAULT 900,
    "lastCheckedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "etag" TEXT,
    "lastModified" TEXT,
    "lastSeenHash" TEXT,
    "selectorConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "rawText" TEXT,
    "summary" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedTimePrecision" "PublishedTimePrecision" NOT NULL DEFAULT 'unknown',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hash" TEXT NOT NULL,
    "language" TEXT,
    "status" "SignalStatus" NOT NULL DEFAULT 'raw',
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleZh" TEXT,
    "summaryZh" TEXT,
    "category" "EventCategory" NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "heatScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "officialConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "status" "EventStatus" NOT NULL DEFAULT 'draft_ai',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FetchLog" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "FetchLogStatus" NOT NULL,
    "message" TEXT,
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "FetchLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Signal_hash_key" ON "Signal"("hash");

-- CreateIndex
CREATE INDEX "Signal_sourceId_idx" ON "Signal"("sourceId");

-- CreateIndex
CREATE INDEX "Signal_status_idx" ON "Signal"("status");

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- CreateIndex
CREATE INDEX "Event_category_idx" ON "Event"("category");

-- CreateIndex
CREATE INDEX "Event_firstSeenAt_idx" ON "Event"("firstSeenAt");

-- CreateIndex
CREATE INDEX "FetchLog_sourceId_idx" ON "FetchLog"("sourceId");

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FetchLog" ADD CONSTRAINT "FetchLog_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
