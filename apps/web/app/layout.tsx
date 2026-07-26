import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { fontDisplay, fontMono } from "./fonts";
import { resolveOrigin } from "@/lib/origin";

export async function generateMetadata(): Promise<Metadata> {
  const origin = resolveOrigin(await headers());
  const imageUrl = origin ? `${origin}/og.png` : undefined;
  const title = "AniRadar · 次元情报站";
  const description = "实时捕捉动画、漫画、游戏与轻小说的新情报。";

  return {
    title,
    description,
    alternates: {
      types: {
        "application/rss+xml": [
          {
            url: origin ? `${origin}/feed.xml` : "/feed.xml",
            title: "AniRadar 情报流 RSS",
          },
        ],
      },
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "zh_CN",
      url: origin,
      images: imageUrl
        ? [
            {
              url: imageUrl,
              width: 1672,
              height: 941,
              alt: "AniRadar 次元情报站",
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="zh"
      suppressHydrationWarning
      className={`${fontDisplay.variable} ${fontMono.variable}`}
    >
      <body>
        <ThemeProvider>
          <SiteHeader />
          <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
            {children}
          </main>
          <footer className="mt-14 border-t border-border/60 bg-card/30">
            <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-7 text-xs text-muted-foreground sm:px-6 lg:px-8">
              <p>
                <span className="font-display font-bold text-foreground">
                  ANIRADAR
                </span>
                <span className="mx-2 text-primary">✦</span>
                让每一个次元新信号都被看见。
              </p>
              <Link
                href="/admin"
                className="rounded-full px-3 py-1.5 transition-colors hover:bg-muted hover:text-foreground"
              >
                管理后台
              </Link>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
