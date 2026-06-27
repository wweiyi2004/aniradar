// 第一版 mock：不翻译，回填占位中文摘要，保留接口供后续接真实模型。
export function summarize(input: { title: string; summary?: string }): {
  titleZh: string;
  summaryZh: string;
} {
  const base = input.summary?.trim() || input.title.trim();
  return {
    titleZh: input.title.trim(),
    summaryZh: base.length > 120 ? base.slice(0, 120) + "…" : base,
  };
}
