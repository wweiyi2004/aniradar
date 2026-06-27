import type { EventCategory, EventStatus, SourceType } from "@aniradar/shared";

export interface BuildEventInput {
  title: string;
  category: EventCategory;
  confidence: number;
  firstSeenAt: Date;
  sourceType: SourceType;
}

export interface BuiltEvent {
  title: string;
  category: EventCategory;
  confidence: number;
  firstSeenAt: Date;
  officialConfirmed: boolean;
  status: EventStatus;
}

const AUTO_PUBLISH_TYPES: SourceType[] = ["official_news", "youtube_rss"];

export function buildEventFromSignal(input: BuildEventInput): BuiltEvent {
  const official = input.sourceType === "official_news" || input.sourceType === "youtube_rss";
  const autoPublish = AUTO_PUBLISH_TYPES.includes(input.sourceType) && input.confidence >= 0.9;
  return {
    title: input.title,
    category: input.category,
    confidence: input.confidence,
    firstSeenAt: input.firstSeenAt,
    officialConfirmed: official,
    status: autoPublish ? "auto_published" : "draft_ai",
  };
}
