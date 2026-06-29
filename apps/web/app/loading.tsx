// 切板块 / 翻页 / 搜索时的加载骨架（force-dynamic SSR 期间显示）。
export default function Loading() {
  return (
    <div className="grid gap-6 lg:grid-cols-[170px_minmax(0,1fr)_280px]">
      <div className="hidden lg:block" />
      <div className="min-w-0 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-md border bg-[hsl(var(--card))] p-4">
            <div className="mb-3 h-3 w-24 rounded bg-[hsl(var(--muted))]" />
            <div className="mb-2 h-4 w-3/4 rounded bg-[hsl(var(--muted))]" />
            <div className="h-3 w-1/2 rounded bg-[hsl(var(--muted))]" />
          </div>
        ))}
      </div>
      <div className="hidden lg:block" />
    </div>
  );
}
