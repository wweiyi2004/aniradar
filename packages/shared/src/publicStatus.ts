import type { EventStatus } from "./index";

/** 始终公开展示的事件状态（已发布）。 */
export const PUBLIC_PUBLISHED_STATUSES = ["auto_published", "published"] as const satisfies readonly EventStatus[];

/**
 * 前台可见事件状态。
 * @param showDraft 为 true 时额外包含 draft_ai（默认 false，草稿仅后台可见）。
 */
export function publicEventStatuses(showDraft = false): readonly EventStatus[] {
  if (showDraft) return [...PUBLIC_PUBLISHED_STATUSES, "draft_ai"];
  return PUBLIC_PUBLISHED_STATUSES;
}
