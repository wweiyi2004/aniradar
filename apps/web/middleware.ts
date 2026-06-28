import { NextResponse, type NextRequest } from "next/server";

// 保护后台页面与后台 API：HTTP Basic Auth，凭据取自环境变量。
export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

export function middleware(req: NextRequest) {
  const expectedUser = process.env.ADMIN_USER || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD;

  // 未配置密码：拒绝访问后台（fail-closed），避免误开放给公网。
  if (!expectedPass) {
    return new NextResponse("后台未配置鉴权：请在 .env 设置 ADMIN_PASSWORD。", { status: 503 });
  }

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const idx = decoded.indexOf(":");
      const user = decoded.slice(0, idx);
      const pass = decoded.slice(idx + 1);
      if (user === expectedUser && pass === expectedPass) {
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
