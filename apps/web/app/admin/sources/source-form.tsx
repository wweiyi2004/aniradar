"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SOURCE_TYPES, FETCH_STRATEGIES, SOURCE_LEVELS } from "@aniradar/shared";

export function SourceForm() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: "",
    url: "",
    type: "media",
    level: "B",
    fetchStrategy: "rss",
    fetchIntervalSec: 900,
    selectorConfig: "",
  });

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/sources", { method: "POST", body: JSON.stringify(f) });
      if (res.ok) location.reload();
      else alert((await res.json()).error);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <Button onClick={() => setOpen(true)}>新增资讯源</Button>;

  return (
    <div className="space-y-2 rounded-md border p-4">
      <Input
        className="w-full"
        placeholder="名称"
        value={f.name}
        onChange={(e) => setF({ ...f, name: e.target.value })}
      />
      <Input
        className="w-full"
        placeholder="URL"
        value={f.url}
        onChange={(e) => setF({ ...f, url: e.target.value })}
      />
      <div className="flex flex-wrap gap-2">
        <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          {SOURCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select value={f.fetchStrategy} onChange={(e) => setF({ ...f, fetchStrategy: e.target.value })}>
          {FETCH_STRATEGIES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>
          {SOURCE_LEVELS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Input
          type="number"
          className="w-28"
          value={f.fetchIntervalSec}
          onChange={(e) => setF({ ...f, fetchIntervalSec: Number(e.target.value) })}
        />
      </div>
      <Textarea
        className="w-full font-mono text-xs"
        rows={3}
        placeholder='selectorConfig JSON（html_list 用，如 {"listItem":".news-list li","title":".title","url":"a"}）'
        value={f.selectorConfig}
        onChange={(e) => setF({ ...f, selectorConfig: e.target.value })}
      />
      <div className="flex gap-2">
        <Button onClick={submit} disabled={busy}>
          {busy ? "保存中…" : "保存"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          取消
        </Button>
      </div>
    </div>
  );
}
