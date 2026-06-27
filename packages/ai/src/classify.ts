import type { ClassifyResult, EventCategory } from "@aniradar/shared";

// 规则：按优先级匹配，先判定特殊类（延期、续期）再判定通用。
// 第一版 mock，不调用大模型；保留 classify 接口供后续替换为真实模型。
const RULES: { keywords: string[]; category: EventCategory; confidence: number }[] = [
  { keywords: ["放送延期", "延期"], category: "delay_announced", confidence: 0.92 },
  { keywords: ["第2期", "第二期", "続編", "2期"], category: "sequel_announced", confidence: 0.92 },
  { keywords: ["アニメ化", "制作決定", "新作アニメ"], category: "anime_adaptation", confidence: 0.93 },
  { keywords: ["劇場版", "映画化"], category: "movie_announced", confidence: 0.9 },
  {
    keywords: ["本PV", "ティザーPV", "ティザー", "特報", "予告", "PV公開", "PV"],
    category: "pv_released",
    confidence: 0.88,
  },
  { keywords: ["キービジュアル", "ビジュアル公開", "ビジュアル"], category: "key_visual_released", confidence: 0.85 },
  { keywords: ["キャスト解禁", "キャスト"], category: "cast_announced", confidence: 0.85 },
  { keywords: ["スタッフ解禁", "スタッフ"], category: "staff_announced", confidence: 0.82 },
  { keywords: ["放送開始", "放送決定", "配信決定", "放送"], category: "broadcast_date_announced", confidence: 0.85 },
  { keywords: ["主題歌", "OP", "ED"], category: "theme_song_announced", confidence: 0.8 },
];

export function classify(input: { title: string; summary?: string; rawText?: string }): ClassifyResult {
  const text = `${input.title}\n${input.summary ?? ""}\n${input.rawText ?? ""}`;
  for (const rule of RULES) {
    if (rule.keywords.some((k) => text.includes(k))) {
      return { isAnimeNews: true, category: rule.category, confidence: rule.confidence };
    }
  }
  return { isAnimeNews: false, category: "other", confidence: 0.2 };
}
