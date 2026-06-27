"use client";
import { Button } from "@/components/ui/button";

export function EventActions({ id }: { id: string }) {
  async function set(status: string) {
    await fetch(`/api/admin/events/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
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
