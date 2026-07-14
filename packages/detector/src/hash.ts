import { createHash } from "node:crypto";

const TRACKING = /^(utm_|fbclid|gclid|ref|spm|mc_|yclid|igshid|si)/i;

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hostname = u.hostname.toLowerCase();
    u.hash = "";
    const keep = [...u.searchParams.entries()]
      .filter(([k]) => !TRACKING.test(k))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    u.search = "";
    for (const [k, v] of keep) u.searchParams.append(k, v);
    let s = u.toString();
    s = s.replace(/\/(?=$|\?)/, ""); // 去末尾斜杠
    return s;
  } catch {
    return raw.trim();
  }
}

export function computeSignalHash(sourceId: string, item: { url: string; title: string }): string {
  const key = `${sourceId}|${normalizeUrl(item.url)}|${item.title.trim()}`;
  return createHash("sha256").update(key).digest("hex");
}

export function computeContentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
