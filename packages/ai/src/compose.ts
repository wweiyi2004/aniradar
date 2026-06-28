import { getAiConfig, chatJson } from "./provider";

export interface ComposeSource {
  name: string; // 来源名（如 "MAPPA"）
  title: string; // 原标题
  text: string; // 原文正文（可能为空）
  url: string;
}

export interface ComposeInput {
  titleZh: string;
  leadZh: string;
  sources: ComposeSource[];
}

export interface ComposeResult {
  bodyZh: string; // 合成的中文正文（分段，纯文本）；skipped 时为空串
  source: "ai" | "skipped";
}

const PER_SOURCE_LIMIT = 1500;

function buildSystem(): string {
  return [
    "你是动漫情报编辑。给定同一事件的若干（多为日文）来源正文，合成一篇连贯的简体中文报道正文。",
    "硬性要求：",
    "1) 只使用来源中明确出现的事实，绝不编造日期、人名、数字或来源未提及的内容；",
    "2) 多个来源说法冲突、或某源有独有信息时，分别陈述并标注来源（如“据 MAPPA 官网”）；",
    "3) 写成自然的叙述分段，不要堆砌“作品名：X／制作：Y”这类字段清单（这些已另行展示）；",
    "4) 若可用正文很少，就基于标题与已知信息写 1~2 句简述，不要硬凑、不要展开想象。",
    "只输出一个 JSON 对象，字段 bodyZh(string)：分段中文正文，段落之间用换行符分隔。",
  ].join("");
}

// 将同一事件的多个来源正文合成一篇中文报道。单源即忠实全文翻译；多源则整合并标注来源。
// 无 AI 配置 / 无可用素材 / 调用失败 → 返回 skipped（调用方不覆盖既有 bodyZh）。
export async function composeArticle(input: ComposeInput): Promise<ComposeResult> {
  const cfg = getAiConfig();
  const usable = input.sources.filter(
    (s) => (s.text ?? "").trim().length > 0 || (s.title ?? "").trim().length > 0,
  );
  if (!cfg || usable.length === 0) return { bodyZh: "", source: "skipped" };

  try {
    const user = [
      `事件标题（已译）: ${input.titleZh}`,
      `导语: ${input.leadZh}`,
      "来源正文：",
      ...usable.map(
        (s, i) =>
          `【来源${i + 1} ${s.name}】标题: ${s.title}\n正文: ${(s.text ?? "").slice(0, PER_SOURCE_LIMIT)}`,
      ),
    ].join("\n");
    const content = await chatJson(cfg, buildSystem(), user, 40_000, 2000);
    const parsed = JSON.parse(content) as { bodyZh?: unknown };
    const bodyZh = typeof parsed.bodyZh === "string" ? parsed.bodyZh.trim() : "";
    if (!bodyZh) return { bodyZh: "", source: "skipped" };
    return { bodyZh, source: "ai" };
  } catch {
    return { bodyZh: "", source: "skipped" };
  }
}
