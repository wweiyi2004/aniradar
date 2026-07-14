"use client";
import { Button } from "@/components/ui/button";

export function EventActions({ id }: { id: string }) {
  async function set(status: string) {
    if (status === "retracted" || status === "ignored") {
      if (!confirm(status === "retracted" ? "确认撤回该事件？" : "确认忽略该事件？")) return;
    }
    const res = await fetch(`/api/admin/events/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error || "操作失败");
      return;
    }
    location.reload();
  }
  return (
    <div className="flex gap-1">
      <Button size="sm" onClick={() => set("published")}>
        发布
      </Button>
      <Button size="sm" variant="outline" onClick={() => set("ignored")}>
        忽略
      </Button>
      <Button size="sm" variant="destructive" onClick={() => set("retracted")}>
        撤回
      </Button>
    </div>
  );
}
