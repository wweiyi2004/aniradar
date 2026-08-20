import { fetch as undiciFetch, Agent, ProxyAgent, type Dispatcher } from "undici";
import { lookup as dnsLookup } from "node:dns";
import type { LookupFunction } from "node:net";
import { env } from "@aniradar/config";
import { isBlockedIpv4, isBlockedIpv6Literal, validateSourceUrl } from "@aniradar/shared";

export interface FetchUrlResult {
  status: number;
  body: string;
  etag?: string;
  lastModified?: string;
  notModified: boolean;
}

function blockedAddress(address: string): boolean {
  return isBlockedIpv4(address) || isBlockedIpv6Literal(address);
}

// 在真正建立 TCP 连接时解析并校验全部地址；回调选中的就是已校验地址，避免
// “先校验域名、连接时再次解析”的 DNS rebinding/TOCTOU 窗口。
// 调用方要求 options.all 时必须回数组：Node 22 的 autoSelectFamily(Happy Eyeballs)
// 走该路径，回单地址会触发 ERR_INVALID_IP_ADDRESS。
const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true, verbatim: true }, (error, result) => {
    if (error) return callback(error, "", 0);
    const addresses = Array.isArray(result) ? result : [{ address: result, family: 0 }];
    const blocked = addresses.find((entry) => blockedAddress(entry.address));
    if (blocked) {
      const e = Object.assign(new Error(`blocked resolved address: ${blocked.address}`), {
        code: "EACCES",
      });
      return callback(e, "", 0);
    }
    if (options && options.all) return callback(null, addresses);
    const selected = addresses[0];
    if (!selected) return callback(new Error(`DNS returned no address for ${hostname}`), "", 0);
    callback(null, selected.address, selected.family);
  });
};

// Node 的全局 fetch/undici 默认不读取 HTTP(S)_PROXY 环境变量。
function buildDispatcher(): { dispatcher: Dispatcher; usesProxy: boolean } {
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;
  if (proxyUrl) {
    return {
      dispatcher: new ProxyAgent({ uri: proxyUrl, connectTimeout: 30_000 }),
      usesProxy: true,
    };
  }
  return {
    dispatcher: new Agent({ connect: { timeout: 30_000, lookup: safeLookup } }),
    usesProxy: false,
  };
}

const { dispatcher, usesProxy } = buildDispatcher();
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

const DEFAULT_HEADERS: Record<string, string> = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml,*/*;q=0.8",
  "accept-language": "ja,en-US;q=0.8,en;q=0.6",
};

async function assertSafeTarget(raw: string): Promise<string> {
  const checked = validateSourceUrl(raw);
  if (!checked.ok) throw new Error(`blocked url: ${checked.error}`);

  // 代理连接在代理端解析目标域名，无法使用上面的连接级 lookup；至少在每次请求和
  // 每一跳重定向前校验本机所见的全部 DNS 记录。代理本身必须属于受信基础设施。
  if (usesProxy) {
    const host = new URL(checked.url).hostname;
    const addresses = await new Promise<{ address: string }[]>((resolve, reject) => {
      dnsLookup(host, { all: true, verbatim: true }, (error, result) => {
        if (error) reject(error);
        else resolve(Array.isArray(result) ? result : [{ address: result }]);
      });
    });
    const blocked = addresses.find((entry) => blockedAddress(entry.address));
    if (blocked) throw new Error(`blocked resolved address: ${blocked.address}`);
  }
  return checked.url;
}

type FetchResponse = Awaited<ReturnType<typeof undiciFetch>>;

export async function readTextLimited(res: FetchResponse, maxBytes: number): Promise<string> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel();
    throw new Error(`response too large: ${declared} bytes (limit ${maxBytes})`);
  }
  if (!res.body) return "";

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new Error(`response too large: exceeded ${maxBytes} bytes`);
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export async function fetchUrl(
  url: string,
  opts: { etag?: string; lastModified?: string; timeoutMs?: number } = {},
): Promise<FetchUrlResult> {
  let currentUrl = await assertSafeTarget(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? env.crawlerTimeoutMs);
  try {
    const headers: Record<string, string> = { ...DEFAULT_HEADERS, "user-agent": env.userAgent };
    if (opts.etag) headers["if-none-match"] = opts.etag;
    if (opts.lastModified) headers["if-modified-since"] = opts.lastModified;

    for (let redirects = 0; ; redirects++) {
      const res = await undiciFetch(currentUrl, {
        headers,
        signal: controller.signal,
        redirect: "manual",
        dispatcher,
      });
      if (REDIRECT_STATUSES.has(res.status)) {
        if (redirects >= MAX_REDIRECTS) {
          await res.body?.cancel();
          throw new Error(`too many redirects for ${url}`);
        }
        const location = res.headers.get("location");
        await res.body?.cancel();
        if (!location) throw new Error(`redirect without location for ${currentUrl}`);
        currentUrl = await assertSafeTarget(new URL(location, currentUrl).toString());
        continue;
      }
      if (res.status === 304) return { status: 304, body: "", notModified: true };
      if (!res.ok) {
        await res.body?.cancel();
        throw new Error(`HTTP ${res.status} for ${currentUrl}`);
      }
      const body = await readTextLimited(res, env.crawlerMaxResponseBytes);
      return {
        status: res.status,
        body,
        notModified: false,
        etag: res.headers.get("etag") ?? undefined,
        lastModified: res.headers.get("last-modified") ?? undefined,
      };
    }
  } finally {
    clearTimeout(timer);
  }
}
