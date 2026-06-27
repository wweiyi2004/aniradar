import { prisma } from "@aniradar/db";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function FetchLogsPage() {
  const logs = await prisma.fetchLog.findMany({
    include: { source: true },
    orderBy: { startedAt: "desc" },
    take: 150,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">抓取日志</h1>
      <Table>
        <THead>
          <TR>
            <TH>来源</TH>
            <TH>状态</TH>
            <TH>fetched</TH>
            <TH>new</TH>
            <TH>message</TH>
            <TH>started</TH>
            <TH>ended</TH>
          </TR>
        </THead>
        <TBody>
          {logs.map((l) => (
            <TR key={l.id}>
              <TD>{l.source.name}</TD>
              <TD
                className={
                  l.status === "failed"
                    ? "text-red-500"
                    : l.status === "success"
                      ? "text-emerald-500"
                      : ""
                }
              >
                {l.status}
              </TD>
              <TD>{l.fetchedCount}</TD>
              <TD>{l.newCount}</TD>
              <TD className="max-w-xs truncate text-xs">{l.message}</TD>
              <TD className="text-xs">{new Date(l.startedAt).toLocaleString("zh-CN")}</TD>
              <TD className="text-xs">{l.endedAt ? new Date(l.endedAt).toLocaleString("zh-CN") : "—"}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
