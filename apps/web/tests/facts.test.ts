import { describe, it, expect } from "vitest";
import { buildFactRows } from "../lib/facts";

describe("buildFactRows", () => {
  it("动画+放送日：底字段+专有字段叠加，空字段跳过", () => {
    const rows = buildFactRows("anime", "broadcast_date_announced", {
      work: "鬼灭之刃", studio: "ufotable", airDate: "2024-04", broadcaster: "TOKYO MX",
      director: "", // 空，跳过
    });
    const labels = rows.map((r) => r.label);
    expect(labels).toContain("作品");
    expect(labels).toContain("制作");
    expect(labels).toContain("开播日");
    expect(labels).toContain("放送平台");
    expect(labels).not.toContain("监督"); // 空被跳过
  });

  it("声优解禁：cast 列表渲染为 {sub,value}", () => {
    const rows = buildFactRows("anime", "cast_announced", {
      work: "某作", cast: [{ role: "田中", name: "花泽香菜" }],
    });
    const castRow = rows.find((r) => r.label === "声优");
    expect(castRow && "list" in castRow && castRow.list[0]).toEqual({ sub: "田中", value: "花泽香菜" });
  });

  it("facts 全空 → 空数组", () => {
    expect(buildFactRows("anime", "pv_released", {})).toEqual([]);
  });

  it("未知 medium 不报错，仅取 category 字段", () => {
    const rows = buildFactRows(null, "movie_announced", { releaseDate: "2025-01-01" });
    expect(rows.map((r) => r.label)).toContain("上映日");
  });
});
