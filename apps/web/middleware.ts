import { NextResponse, type NextRequest } from "next/server";

// 保护后台页面与后台 API：HTTP Basic Auth，凭据取自环境变量。
export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

function safeEqual(a: string, b: string): boolean {
  // Edge middleware 无 node:crypto；长度不等时仍做等长比较，降低时序泄漏。
  const len = Math.max(a.length, b.length);
  let out = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    out |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return out === 0;
}

export function middleware(req: NextRequest) {
  const expectedUser = process.env.ADMIN_USER || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD;

  // 未配置密码：拒绝访问后台（fail-closed），避免误开放给公网。
  if (!expectedPass) {
    return new NextResponse("后台未配置鉴权：请在 .env 设置 ADMIN_PASSWORD。", { status: 503 });
  }

  // Basic Auth 会被浏览器自动附带；对变更型后台 API 拒绝跨站请求，避免 CSRF。
  // 不信任客户端可控的 X-Forwarded-Host；优先 PUBLIC_ORIGIN / 配置的 Host。
  if (
    req.nextUrl.pathname.startsWith("/api/admin/") &&
    !["GET", "HEAD", "OPTIONS"].includes(req.method)
  ) {
    const site = req.headers.get("sec-fetch-site");
    if (site === "cross-site") {
      return new NextResponse("拒绝跨站后台请求。", { status: 403 });
    }
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    const configured = process.env.PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL;
    let expectedHost: string | null = null;
    if (configured) {
      try {
        expectedHost = new URL(configured).host;
      } catch {
        expectedHost = null;
      }
    }
    if (!expectedHost) expectedHost = req.headers.get("host");
    const source = origin || referer;
    if (!source || !expectedHost) {
      return new NextResponse("拒绝缺少 Origin/Referer 的后台变更请求。", { status: 403 });
    }
    try {
      if (new URL(source).host !== expectedHost) {
        return new NextResponse("拒绝跨站后台请求。", { status: 403 });
      }
    } catch {
      return new NextResponse("拒绝跨站后台请求。", { status: 403 });
    }
  }

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const idx = decoded.indexOf(":");
      const user = decoded.slice(0, idx);
      const pass = decoded.slice(idx + 1);
      if (safeEqual(user, expectedUser) && safeEqual(pass, expectedPass)) {
        return NextResponse.next();
      }
    } catch {
      // 解码失败 → 落到 401
    }
  }

  return new NextResponse("需要登录后台。", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="AniRadar Admin", charset="UTF-8"' },
  });
}
