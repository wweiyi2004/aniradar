// 规则回退：不做真实翻译，但尽量保留更多上下文，避免详情页只有一句标题。
export function summarize(input: { title: string; summary?: string; rawText?: string }): {
  titleZh: string;
  summaryZh: string;
} {
  const base = input.rawText?.trim() || input.summary?.trim() || input.title.trim();
  return {
    titleZh: input.title.trim(),
    summaryZh: base.length > 280 ? base.slice(0, 280) + "…" : base,
  };
}
