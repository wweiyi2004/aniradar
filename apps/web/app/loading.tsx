// 切板块 / 翻页 / 搜索时的加载骨架（force-dynamic SSR 期间显示）。
export default function Loading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="anime-card flex gap-3 p-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-8 w-16 shrink-0 rounded-full bg-muted" />
        ))}
      </div>

      <div className="space-y-4">
        <div className="h-8 w-40 rounded-lg bg-muted" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(250px,0.7fr)]">
          <div className="anime-card min-h-[350px] bg-muted/70" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="anime-card min-h-36 bg-muted/70" />
            <div className="anime-card min-h-36 bg-muted/70" />
          </div>
        </div>
      </div>

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <div className="mb-4 h-8 w-40 rounded-lg bg-muted" />
          <div className="anime-card divide-y divide-border px-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-5">
                <div className="space-y-3">
                  <div className="h-3 w-40 rounded bg-muted" />
                  <div className="h-5 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
                <div className="h-20 w-20 rounded-2xl bg-muted sm:h-24 sm:w-36" />
              </div>
            ))}
          </div>
        </div>
        <div className="hidden space-y-4 lg:block">
          <div className="anime-card h-72 bg-muted/70" />
          <div className="anime-card h-56 bg-muted/70" />
        </div>
      </div>
    </div>
  );
}
