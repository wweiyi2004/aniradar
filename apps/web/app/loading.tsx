// 切板块 / 翻页 / 搜索时的加载骨架（force-dynamic SSR 期间显示）。
export default function Loading() {
  return (
    <div className="animate-pulse space-y-8">
      {/* 板块导航条带 */}
      <div className="flex gap-4 border-b pb-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-4 w-14 rounded bg-muted" />
        ))}
      </div>

      {/* 头条区 */}
      <div className="space-y-4">
        <div className="aspect-[16/9] w-full rounded-xl bg-muted" />
        <div className="h-3 w-40 rounded bg-muted" />
        <div className="h-8 w-3/4 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* 信息流行 */}
        <div className="min-w-0 divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-5">
              <div className="space-y-3">
                <div className="h-3 w-40 rounded bg-muted" />
                <div className="h-5 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
              <div className="hidden h-24 w-40 rounded-md bg-muted sm:block" />
            </div>
          ))}
        </div>
        {/* 右栏 */}
        <div className="hidden space-y-4 lg:block">
          <div className="h-4 w-32 rounded bg-muted" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 w-full rounded bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
