/** 源抓取 URL 校验：仅 http(s)，拒绝明显的内网/环回目标，降低 SSRF 风险。 */

export type UrlValidationOk = { ok: true; url: string };
export type UrlValidationErr = { ok: false; error: string };
export type UrlValidationResult = UrlValidationOk | UrlValidationErr;

// 环回 / 链路本地 / 文档保留 / 云元数据常见主机名（字面匹配，不依赖 DNS）。
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
]);

function isIpv4(host: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
}

function parseIpv4(host: string): number[] | null {
  if (!isIpv4(host)) return null;
  const parts = host.split(".").map((p) => Number(p));
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return parts;
}

/** 是否为不应作为抓取目标的 IPv4（私网、环回、链路本地、未指定、CGNAT 等）。 */
export function isBlockedIpv4(host: string): boolean {
  const p = parseIpv4(host);
  if (!p) return false;
  const [a, b] = p;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a >= 224) return true; // multicast / reserved
  return false;
}

/** 粗略识别 IPv6 字面量中的环回/链路本地/ULA（含 [::1]、[fe80::]、[fc00::]/[fd00::]）。 */
export function isBlockedIpv6Literal(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fe80:")) return true; // link-local
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // ULA
  if (h.startsWith("::ffff:")) {
    // IPv4-mapped：检查内嵌 IPv4
    const mapped = h.slice("::ffff:".length);
    if (isBlockedIpv4(mapped)) return true;
  }
  return false;
}

/**
 * 校验资讯源 URL。成功时返回规范化后的 href（保留 path/query）。
 * 不做 DNS 解析，仅基于字面主机名/IP 拦截常见内网目标。
 */
export function validateSourceUrl(raw: unknown): UrlValidationResult {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: "url 必填" };
  }
  const trimmed = raw.trim();
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return { ok: false, error: "url 格式无效" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, error: "url 仅允许 http/https" };
  }
  if (u.username || u.password) {
    return { ok: false, error: "url 不允许内嵌用户名/密码" };
  }
  const host = u.hostname.toLowerCase();
  if (!host) return { ok: false, error: "url 缺少主机名" };
  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, error: "url 主机名不允许（环回/元数据）" };
  }
  if (isBlockedIpv4(host) || isBlockedIpv6Literal(host)) {
    return { ok: false, error: "url 不允许指向私网/环回地址" };
  }
  // 末尾点域名（localhost.）等
  if (host.endsWith(".localhost") || host.endsWith(".local")) {
    return { ok: false, error: "url 主机名不允许（.localhost/.local）" };
  }
  return { ok: true, url: u.href };
}
