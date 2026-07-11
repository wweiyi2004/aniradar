import { fetch as undiciFetch, Agent, ProxyAgent, type Dispatcher } from "undici";
import { env } from "@aniradar/config";
import { validateSourceUrl } from "@aniradar/shared";

export interface FetchUrlResult {
  status: number;
  body: string;
  etag?: string;
  lastModified?: string;
  notModified: boolean;
}

// Node 的全局 fetch/undici 默认不读取 HTTP(S)_PROXY 环境变量。
// 这里显式按环境变量构造 dispatcher：有代理走 ProxyAgent，否则用带较长连接超时的 Agent。
function buildDispatcher(): Dispatcher {
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;
  if (proxyUrl) {
    return new ProxyAgent({ uri: proxyUrl, connectTimeout: 30_000 });
  }
  return new Agent({ connect: { timeout: 30_000 } });
}

const dispatcher = buildDispatcher();

const DEFAULT_HEADERS: Record<string, string> = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml,*/*;q=0.8",
  "accept-language": "ja,en-US;q=0.8,en;q=0.6",
};

export async function fetchUrl(
  url: string,
  opts: { etag?: string; lastModified?: string; timeoutMs?: number } = {},
): Promise<FetchUrlResult> {
  // 统一 SSRF 门禁：后台入库校验之外，运行时再挡一次（含种子/历史脏数据）。
  const urlCheck = validateSourceUrl(url);
  if (!urlCheck.ok) {
    throw new Error(`blocked url: ${urlCheck.error}`);
  }
  const safeUrl = urlCheck.url;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? env.crawlerTimeoutMs);
  try {
    const headers: Record<string, string> = { ...DEFAULT_HEADERS, "user-agent": env.userAgent };
    if (opts.etag) headers["if-none-match"] = opts.etag;
    if (opts.lastModified) headers["if-modified-since"] = opts.lastModified;
    const res = await undiciFetch(safeUrl, {
      headers,
      signal: controller.signal,
      redirect: "follow",
      dispatcher,
    });
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
