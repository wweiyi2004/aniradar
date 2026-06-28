import * as cheerio from "cheerio";
import type { FetchedItem } from "@aniradar/shared";
import { parseLooseDate } from "./date";

export interface SelectorConfig {
  listItem: string;
  title: string;
  url: string;
  date?: string;
  summary?: string;
}

export function parseHtmlList(html: string, cfg: SelectorConfig, baseUrl: string): FetchedItem[] {
  const $ = cheerio.load(html);
  const out: FetchedItem[] = [];
  $(cfg.listItem).each((_, el) => {
    const node = $(el);
    const title = node.find(cfg.title).first().text().trim();
    const href = node.find(cfg.url).first().attr("href") ?? "";
    if (!title || !href) return;
    let url: string;
    try {
      url = new URL(href, baseUrl).toString();
    } catch {
      return;
    }
    const dateText = cfg.date ? node.find(cfg.date).first().text().trim() : "";
    const d = parseLooseDate(dateText);
    const valid = !!d;
    out.push({
      title,
      url,
      summary: cfg.summary ? node.find(cfg.summary).first().text().trim() || undefined : undefined,
      publishedAt: valid ? d : undefined,
      publishedTimePrecision: valid ? "date_only" : "unknown",
    });
  });
  return out;
}
