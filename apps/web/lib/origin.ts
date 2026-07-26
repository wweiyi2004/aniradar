/**
 * 站点对外 origin 推导。
 * 反代部署时应配置 PUBLIC_ORIGIN(https://your.domain),它同时服务于
 * CSRF 校验、OG 绝对链接、sitemap 与 RSS;未配置时回退请求头推导。
 */

/** 仅取显式配置的 PUBLIC_ORIGIN;非法或未配置返回 undefined。 */
export function configuredOrigin(): string | undefined {
  const raw = process.env.PUBLIC_ORIGIN?.trim();
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

/** 优先 PUBLIC_ORIGIN,否则从请求头(x-forwarded-host/host + x-forwarded-proto)推导。 */
export function resolveOrigin(requestHeaders: Headers): string | undefined {
  const configured = configuredOrigin();
  if (configured) return configured;
  const host = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"))
    ?.split(",")[0]
    .trim();
  if (!host) return undefined;
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https";
  return `${protocol}://${host}`;
}

/** 无请求上下文场景(sitemap/robots)用:未配置 PUBLIC_ORIGIN 时回退本地地址。 */
export function siteOrigin(): string {
  return configuredOrigin() ?? "http://localhost:3000";
}
