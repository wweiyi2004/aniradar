"use client";
import { Button } from "@/components/ui/button";

export function SourceRowActions({ id, enabled }: { id: string; enabled: boolean }) {
  async function toggle() {
    await fetch(`/api/admin/sources/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !enabled }),
    });
    location.reload();
  }
  async function trigger() {
    const r = await fetch(`/api/admin/sources/${id}/fetch`, { method: "POST" });
    alert(r.ok ? "已触发抓取" : "触发失败");
  }
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={toggle}>
        {enabled ? "禁用" : "启用"}
      </Button>
      <Button size="sm" onClick={trigger}>
        抓取
      </Button>
    </div>
  );
}
