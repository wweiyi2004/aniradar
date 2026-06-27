import { buildFactRows } from "@/lib/facts";

export function FactTable({ medium, category, facts }: { medium: string | null; category: string; facts: unknown }) {
  const rows = buildFactRows(medium, category, facts);
  if (rows.length === 0) return null;
  return (
    <dl className="grid grid-cols-[5rem_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map((r, i) => (
        <div key={i} className="contents">
          <dt className="text-[hsl(var(--muted-foreground))]">{r.label}</dt>
          <dd className="min-w-0">
            {"value" in r ? (
              <span className="break-words">{r.value}</span>
            ) : (
              <ul className="space-y-0.5">
                {r.list.map((it, j) => (
                  <li key={j} className="break-words">
                    <span className="text-[hsl(var(--muted-foreground))]">{it.sub}</span>
                    {it.sub ? " → " : ""}
                    {it.value}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
