import type { EventCategory, EventStatus, SourceType } from "@aniradar/shared";

export interface BuildEventInput {
  title: string;
  category: EventCategory;
  confidence: number;
  firstSeenAt: Date;
  sourceType: SourceType;
  /** 仅真实 AI 结果允许 auto_publish；mock/规则回退禁止自动上公开流 */
  analysisSource?: "ai" | "mock" | "prefilter";
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

// 公开可见（draft_ai 及以上）要求的最低置信度；低于此值进 needs_review 等人工审核，
// 不出现在公开情报流里。
export const MIN_PUBLIC_CONFIDENCE = 0.6;

export function buildEventFromSignal(input: BuildEventInput): BuiltEvent {
  const official = input.sourceType === "official_news" || input.sourceType === "youtube_rss";
  const fromAi = !input.analysisSource || input.analysisSource === "ai";
  const autoPublish =
    fromAi && AUTO_PUBLISH_TYPES.includes(input.sourceType) && input.confidence >= 0.9;
  const status: EventStatus = autoPublish
    ? "auto_published"
    : input.confidence >= MIN_PUBLIC_CONFIDENCE
      ? "draft_ai"
      : "needs_review";
  return {
    title: input.title,
    category: input.category,
    confidence: input.confidence,
    firstSeenAt: input.firstSeenAt,
    officialConfirmed: official,
    status,
  };
}
