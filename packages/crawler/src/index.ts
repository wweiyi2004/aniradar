import { env } from "@aniradar/config";

export interface FetchUrlResult {
  status: number;
  body: string;
  etag?: string;
  lastModified?: string;
  notModified: boolean;
}

export async function fetchUrl(
  url: string,
  opts: { etag?: string; lastModified?: string } = {},
): Promise<FetchUrlResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.crawlerTimeoutMs);
  try {
    const headers: Record<string, string> = { "user-agent": env.userAgent };
    if (opts.etag) headers["if-none-match"] = opts.etag;
    if (opts.lastModified) headers["if-modified-since"] = opts.lastModified;
    const res = await fetch(url, { headers, signal: controller.signal, redirect: "follow" });
    if (res.status === 304) return { status: 304, body: "", notModified: true };
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const body = await res.text();
    return {
      status: res.status,
      body,
      notModified: false,
      etag: res.headers.get("etag") ?? undefined,
      lastModified: res.headers.get("last-modified") ?? undefined,
    };
  } finally {
    clearTimeout(timer);
  }
}
