-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Event_publishedAt_idx" ON "Event"("publishedAt");
