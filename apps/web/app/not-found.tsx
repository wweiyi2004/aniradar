import Link from "next/link";
import { ArrowLeft, Radar, Sparkles } from "lucide-react";

export default function NotFound() {
  return (
    <div className="anime-card relative mx-auto flex min-h-[55vh] max-w-3xl flex-col items-center justify-center gap-4 overflow-hidden px-6 text-center">
      <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
      <p className="font-display text-8xl font-bold leading-none text-primary/15">
        404
      </p>
      <span className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
        <Radar className="h-8 w-8" />
        <Sparkles className="absolute right-2 top-2 h-3 w-3" />
      </span>
      <div>
        <h1 className="font-display text-3xl font-bold">情报未找到</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          这个信号可能已被合并、撤回，或飘向了别的次元。
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"
      >
        <ArrowLeft className="h-4 w-4" />
        返回情报流
      </Link>
    </div>
  );
}
