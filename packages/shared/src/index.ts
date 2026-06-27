export const SOURCE_TYPES = [
  "official_news",
  "youtube_rss",
  "press",
  "media",
  "company_news",
  "publisher_news",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_LEVELS = ["S", "A", "B", "C"] as const;
export type SourceLevel = (typeof SOURCE_LEVELS)[number];

export const FETCH_STRATEGIES = ["rss", "youtube_rss", "html_list", "page_diff"] as const;
export type FetchStrategy = (typeof FETCH_STRATEGIES)[number];

export const PUBLISHED_TIME_PRECISION = ["datetime", "date_only", "unknown"] as const;
export type PublishedTimePrecision = (typeof PUBLISHED_TIME_PRECISION)[number];

export const SIGNAL_STATUS = ["raw", "classified", "ignored", "merged", "failed"] as const;
export type SignalStatus = (typeof SIGNAL_STATUS)[number];

export const EVENT_CATEGORIES = [
  "anime_adaptation",
  "sequel_announced",
  "pv_released",
  "key_visual_released",
  "cast_announced",
  "staff_announced",
  "broadcast_date_announced",
  "delay_announced",
  "movie_announced",
  "theme_song_announced",
  "event_info",
  "merch_release",
  "bd_release",
  "other",
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_STATUS = [
  "draft_ai",
  "auto_published",
  "published",
  "needs_review",
  "ignored",
  "merged",
  "retracted",
] as const;
export type EventStatus = (typeof EVENT_STATUS)[number];

export const FETCHLOG_STATUS = ["success", "failed", "skipped"] as const;
export type FetchLogStatus = (typeof FETCHLOG_STATUS)[number];

export interface FetchedItem {
  title: string;
  url: string;
  rawText?: string;
  summary?: string;
  imageUrl?: string;
  videoUrl?: string;
  publishedAt?: Date;
  publishedTimePrecision: PublishedTimePrecision;
  externalId?: string;
}

export interface FetchResult {
  items: FetchedItem[];
  etag?: string;
  lastModified?: string;
  notModified?: boolean;
}

export interface ClassifyResult {
  isAnimeNews: boolean;
  category: EventCategory;
  confidence: number; // 0..1
}

export const QUEUE_FETCH = "fetch-source";
export const QUEUE_CLASSIFY = "classify-signal";
export const QUEUE_REANALYZE = "reanalyze-signal";

export interface FetchJobData {
  sourceId: string;
}

export interface ClassifyJobData {
  signalId: string;
}

export interface ReanalyzeJobData {
  signalId: string;
}
