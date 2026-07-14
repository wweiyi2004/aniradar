import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { fontDisplay, fontMono } from "./fonts";

export const metadata: Metadata = {
  title: "AniRadar · 动漫新情报雷达",
  description: "实时监测动漫新情报，按首次发现时间整理成情报流。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" suppressHydrationWarning className={`${fontDisplay.variable} ${fontMono.variable}`}>
      <body>
        <ThemeProvider>
          <SiteHeader />
          <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
          <footer className="mt-12 border-t">
            <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:px-6 lg:px-8">
              <p>© AniRadar · 聚合官方 News / 媒体 RSS / YouTube RSS，按首次发现时间整理。</p>
              <Link href="/admin" className="hover:text-foreground">
                管理后台
              </Link>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
