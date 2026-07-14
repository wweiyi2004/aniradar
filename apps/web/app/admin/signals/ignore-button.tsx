"use client";
import { Button } from "@/components/ui/button";

export function IgnoreButton({ id }: { id: string }) {
  async function go() {
    if (!confirm("确认忽略该信号？若为其事件唯一来源，事件也会被忽略。")) return;
    const r = await fetch(`/api/admin/signals/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "ignored" }),
    });
    if (!r.ok) {
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      alert(data.error || "操作失败");
      return;
    }
    location.reload();
  }
  return (
    <Button size="sm" variant="outline" onClick={go}>
      忽略
    </Button>
  );
}
