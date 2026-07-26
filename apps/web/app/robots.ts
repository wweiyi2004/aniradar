import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/origin";

// 运行时读 env,避免构建期固化 PUBLIC_ORIGIN。
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
