import { prisma } from "@aniradar/db";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { SourceForm } from "./source-form";
import { SourceRowActions } from "./actions";

export const dynamic = "force-dynamic";

function fmt(d: Date | null) {
  return d ? new Date(d).toLocaleString("zh-CN") : "—";
}

export default async function SourcesPage() {
  const sources = await prisma.source.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">资讯源</h1>
      <SourceForm />
      <Table>
        <THead>
          <TR>
            <TH>名称</TH>
            <TH>类型/策略</TH>
            <TH>启用</TH>
            <TH>lastChecked</TH>
            <TH>lastSuccess</TH>
            <TH>失败</TH>
            <TH>操作</TH>
          </TR>
        </THead>
        <TBody>
          {sources.map((s) => (
            <TR key={s.id}>
              <TD>
                <div className="font-medium">{s.name}</div>
                <div className="max-w-xs truncate text-xs text-[hsl(var(--muted-foreground))]">{s.url}</div>
              </TD>
              <TD>
                {s.type}
                <br />
                <span className="text-xs">{s.fetchStrategy}</span>
              </TD>
              <TD>{s.enabled ? "✓" : "—"}</TD>
              <TD className="text-xs">{fmt(s.lastCheckedAt)}</TD>
              <TD className="text-xs">{fmt(s.lastSuccessAt)}</TD>
              <TD>{s.failureCount}</TD>
              <TD>
                <SourceRowActions id={s.id} enabled={s.enabled} />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
