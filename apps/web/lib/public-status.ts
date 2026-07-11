import { publicEventStatuses, type EventStatus } from "@aniradar/shared";

/**
 * 前台是否展示 AI 草稿（draft_ai）。
 * 默认 false：草稿仅后台可见，避免未审核内容进公开展示。
 * 本地调试可设 PUBLIC_SHOW_DRAFT=true。
 */
export function showDraftOnPublic(): boolean {
  const v = process.env.PUBLIC_SHOW_DRAFT?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** 首页 / 详情等公开展示用的事件 status 列表。 */
export function getPublicEventStatuses(): readonly EventStatus[] {
  return publicEventStatuses(showDraftOnPublic());
}
