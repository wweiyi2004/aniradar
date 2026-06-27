import { EVENT_CATEGORIES, type EventCategory, type Medium, MEDIUMS, mediumFromCategory } from "@aniradar/shared";
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
  medium: Medium;
  category: EventCategory;
  confidence: number;
  titleZh: string;
  leadZh: string;
  summaryZh: string; // 兼容旧调用：与 leadZh 同值
  facts: Record<string, unknown>;
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
    "leadZh 写成一句话简体中文导语（≤60字）：只讲“公布了什么”。",
    "medium 从以下之一选，按“这条情报讲的是哪种媒介的动态”判断（动画化/PV/放送→anime，不看原作）：",
    MEDIUMS.join(", ") + "。拿不准用 other。",
    "facts 输出一个 JSON 对象，只填原文明确陈述的事实字段，未知字段直接省略，不要编造日期/人名。",
    "facts 可用键（按需取）：work,original,studio,director,author,magazine,publisher,illustrator,label,platform,developer,genre,releaseDate,distributor,itemName,date,place,note,expectedAir,season,pvType,duration,pvUrl,kvDate,airDate,broadcaster,streaming,originalDate,newDate,reason,theaters,songType,songTitle,artist,eventName,eventDate,venue,price,spec,volume。",
    "cast/staff 为数组，元素 {role,name}。",
    "只输出一个 JSON 对象，字段：isAnimeNews(boolean), medium(string), category(string), confidence(0~1 number), titleZh(string), leadZh(string), facts(object)。",
    `category 必须是以下之一：${EVENT_CATEGORIES.join(", ")}。非情报时 category 用 "other"。`,
  ].join("");
}

function mockAnalyze(input: AnalyzeInput): AnalyzeResult {
  const c = classify(input);
  const s = summarize(input);
  const lead = s.summaryZh;
  return {
    isAnimeNews: c.isAnimeNews,
    medium: mediumFromCategory(c.category),
    category: c.category,
    confidence: c.confidence,
    titleZh: s.titleZh,
    leadZh: lead,
    summaryZh: lead,
    facts: {},
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
    const rawMedium = String(parsed.medium ?? "other");
    const medium: Medium = (MEDIUMS as readonly string[]).includes(rawMedium)
      ? (rawMedium as Medium)
      : "other";
    const leadZh = String(parsed.leadZh ?? parsed.summaryZh ?? "").trim() || (input.summary ?? "").trim();
    const facts = (parsed.facts && typeof parsed.facts === "object" && !Array.isArray(parsed.facts))
      ? (parsed.facts as Record<string, unknown>)
      : {};

    return {
      isAnimeNews,
      medium: isAnimeNews ? medium : "other",
      category: isAnimeNews ? category : "other",
      confidence,
      titleZh,
      leadZh,
      summaryZh: leadZh,
      facts: isAnimeNews ? facts : {},
      source: "ai",
    };
  } catch {
    // 任意失败（网络/超时/解析）回退 mock，不阻断抓取闭环。
    return mockAnalyze(input);
  }
}