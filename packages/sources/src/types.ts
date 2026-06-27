import type { FetchResult, FetchStrategy } from "@aniradar/shared";
import type { SelectorConfig } from "@aniradar/parser";

export interface SourceLike {
  url: string;
  fetchStrategy: FetchStrategy;
  etag?: string | null;
  lastModified?: string | null;
  lastSeenHash?: string | null;
  selectorConfig?: unknown;
}

export interface SourceAdapter {
  fetch(source: SourceLike): Promise<FetchResult>;
}

export function asSelectorConfig(v: unknown): SelectorConfig {
  const c = (v ?? {}) as Partial<SelectorConfig>;
  if (!c.listItem || !c.title || !c.url) throw new Error("selectorConfig 缺少 listItem/title/url");
  return c as SelectorConfig;
}
