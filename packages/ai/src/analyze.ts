import { EVENT_CATEGORIES, type EventCategory } from "@aniradar/shared";
import { classify } from "./classify";
import { summarize } from "./summarize";
import { getAiConfig, chatJson } from "./provider";

export interface AnalyzeInput {
  title: string;
  summary?: string;
  rawText?: string;
}

export interface AnalyzeResult {
  isAnimeNews: boolean;
  category: EventCategory;
  confidence: number;
  titleZh: string;
  summaryZh: string;
  source: "ai" | "mock";
}

// 是否对“非动漫情报”的条目也翻译标题/摘要（默认开；同一次调用完成，几乎不增加成本）。
function translateNonNews(): boolean {
  return process.env.AI_TRANSLATE_NON_NEWS !== "false";
}

function buildSystem(): string {
  const transRule = translateNonNews()
    ? "无论是否动漫情报，titleZh/summaryZh 都翻译成简体中文。"
    : "仅动漫情报才翻译；非情报时 titleZh 可保留原文、summaryZh 留空。";
  return [
    "你是动漫新情报分类与翻译助手。给定一条（多为日文的）资讯，判断它是否属于“动漫新情报”，",
    "并做粗分类，同时把标题与摘要翻译成简体中文。",
    "动漫新情报指：动画化、续作/新一季、PV/预告/特报、主视觉/key visual、声优解禁、STAFF 解禁、",
    "放送/配信日期、延期、剧场版/电影化、主题歌、活动信息、周边发售、BD/DVD 发售等官方/媒体情报。",
    "纯周边联名、广告、专栏、与动漫无关的内容判为非情报（isAnimeNews=false）。",
    transRule,
    "summaryZh 要写成简体中文情报简报，180~280字，2~4句话；优先交代：公布了什么、作品/企划名、播出/上映/配信时间、制作/声优/主视觉/PV等关键信息。",
    "不要只复述标题；不要写空泛评价；信息不足时说明“目前公开信息有限”，但仍基于标题/摘要/正文提炼已知事实。",
    "只输出一个 JSON 对象，字段：",
    "isAnimeNews(boolean), category(string), confidence(0~1 number), titleZh(string), summaryZh(string)。",
    `category 必须是以下之一：${EVENT_CATEGORIES.join(", ")}。非情报时 category 用 "other"。`,
  ].join("");
}

function mockAnalyze(input: AnalyzeInput): AnalyzeResult {
  const c = classify(input);
  const s = summarize(input);
  return {
    isAnimeNews: c.isAnimeNews,
    category: c.category,
    confidence: c.confidence,
    titleZh: s.titleZh,
    summaryZh: s.summaryZh,
    source: "mock",
  };
}

// 主入口：配置了 AI 则一次调用完成分类+翻译；否则/失败则回退规则 mock，保证管线不中断。
export async function analyze(input: AnalyzeInput): Promise<AnalyzeResult> {
  const cfg = getAiConfig();
  if (!cfg) return mockAnalyze(input);

  try {
    const user = [
      `标题: ${input.title}`,
      `摘要: ${input.summary ?? ""}`,
      `正文片段: ${(input.rawText ?? "").slice(0, 1800)}`,
    ].join("\n");
    const content = await chatJson(cfg, buildSystem(), user);
    const parsed = JSON.parse(content) as Record<string, unknown>;

    const isAnimeNews = Boolean(parsed.isAnimeNews);
    const rawCat = String(parsed.category ?? "other");
    const category: EventCategory = (EVENT_CATEGORIES as readonly string[]).includes(rawCat)
      ? (rawCat as EventCategory)
      : "other";
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    const titleZh = String(parsed.titleZh ?? input.title).trim() || input.title;
    const summaryZh = String(parsed.summaryZh ?? "").trim() || (input.summary ?? "").trim();

    return {
      isAnimeNews,
      category: isAnimeNews ? category : "other",
      confidence,
      titleZh,
      summaryZh,
      source: "ai",
    };
  } catch {
    // 任意失败（网络/超时/解析）回退 mock，不阻断抓取闭环。
    return mockAnalyze(input);
  }
}
