import { prisma } from "@aniradar/db";
import { SIGNAL_STATUS } from "@aniradar/shared";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { AdminNav } from "@/components/admin-nav";
import { IgnoreButton } from "./ignore-button";

export const dynamic = "force-dynamic";

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sourceId?: string }>;
}) {
  const query = await searchParams;
  const where: { status?: string; sourceId?: string } = {};
  if (query.status) where.status = query.status;
  if (query.sourceId) where.sourceId = query.sourceId;

  const [signals, sources] = await Promise.all([
    prisma.signal.findMany({
      where: where as never,
      include: { source: true },
      orderBy: { firstSeenAt: "desc" },
      take: 100,
    }),
    prisma.source.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <AdminNav active="/admin/signals" />
      <h1 className="text-xl font-bold">Signals</h1>
      <form className="flex flex-wrap gap-2 text-sm">
        <Select name="status" defaultValue={query.status ?? ""}>
          <option value="">全部状态</option>
          {SIGNAL_STATUS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select name="sourceId" defaultValue={query.sourceId ?? ""}>
          <option value="">全部来源</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <button className="rounded-md border px-3">筛选</button>
      </form>
      <Table>
        <THead>
          <TR>
            <TH>标题</TH>
            <TH>来源</TH>
            <TH>状态</TH>
            <TH>firstSeenAt</TH>
            <TH>操作</TH>
          </TR>
        </THead>
        <TBody>
          {signals.map((s) => (
            <TR key={s.id}>
              <TD className="max-w-md">
                <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">
                  {s.titleZh || s.title}
                </a>
                {s.titleZh && s.titleZh !== s.title && (
                  <div className="text-xs text-muted-foreground">{s.title}</div>
                )}
              </TD>
              <TD>{s.source.name}</TD>
              <TD>{s.status}</TD>
              <TD className="text-xs">{new Date(s.firstSeenAt).toLocaleString("zh-CN")}</TD>
              <TD>{s.status !== "ignored" && <IgnoreButton id={s.id} />}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
