"use client";
import { Button } from "@/components/ui/button";

export function IgnoreButton({ id }: { id: string }) {
  async function go() {
    await fetch(`/api/admin/signals/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "ignored" }),
    });
    location.reload();
  }
  return (
    <Button size="sm" variant="outline" onClick={go}>
      忽略
    </Button>
  );
}
