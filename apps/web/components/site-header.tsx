import Link from "next/link";
import { Radar, Search, Sparkles } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/75 backdrop-blur-2xl">
      <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-3"
          aria-label="AniRadar 首页"
        >
          <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-violet-500 to-accent text-white shadow-[0_8px_22px_hsl(var(--primary)/0.28)] transition-transform group-hover:-rotate-3 group-hover:scale-105">
            <Radar className="h-5 w-5" />
            <Sparkles className="absolute right-1 top-1 h-2.5 w-2.5" />
          </span>
          <span>
            <span className="block font-display text-lg font-bold leading-none tracking-[-0.04em] sm:text-xl">
              ANI<span className="text-primary">RADAR</span>
            </span>
            <span className="mt-1 hidden text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground sm:block">
              次元情报站
            </span>
          </span>
          <span className="hidden items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600 md:inline-flex dark:text-emerald-400">
            <span className="signal-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live
          </span>
        </Link>
        <form action="/" method="get" className="relative ml-auto shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            placeholder="搜索作品/情报"
            aria-label="搜索"
            className="h-10 w-36 rounded-full border border-border/80 bg-card/70 pl-9 pr-3 text-sm shadow-sm transition-all placeholder:text-muted-foreground/75 focus:w-52 focus:border-primary/50 focus:bg-card focus-visible:outline-none sm:w-48 sm:focus:w-64"
          />
        </form>
        <ThemeToggle />
      </div>
    </header>
  );
}
