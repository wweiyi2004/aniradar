import { formatDistanceToNowStrict } from "date-fns";
import { zhCN } from "date-fns/locale";

export function relTime(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60_000) return "刚刚发现";
  return formatDistanceToNowStrict(new Date(d), { locale: zhCN, addSuffix: true }) + "发现";
}

export const CATEGORY_LABEL: Record<string, string> = {
  anime_adaptation: "动画化",
  sequel_announced: "续作",
  pv_released: "PV公开",
  key_visual_released: "主视觉",
  cast_announced: "声优",
  staff_announced: "STAFF",
  broadcast_date_announced: "放送",
  delay_announced: "延期",
  movie_announced: "剧场版",
  theme_song_announced: "主题歌",
  event_info: "活动",
  merch_release: "周边",
  bd_release: "BD/DVD",
  other: "其他",
};

export const STATUS_LABEL: Record<string, string> = {
  draft_ai: "AI草稿",
  auto_published: "自动发布",
  published: "已发布",
  needs_review: "待审核",
  ignored: "已忽略",
  merged: "已合并",
  retracted: "已撤回",
};
