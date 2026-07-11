import { describe, it, expect } from "vitest";
import { parseSourceCreate, parseSourcePatch } from "../lib/source-input";

describe("parseSourceCreate", () => {
  const base = {
    name: "测试源",
    url: "https://example.com/rss.xml",
    type: "media",
    fetchStrategy: "rss",
  };

  it("accepts valid payload", () => {
    const r = parseSourceCreate(base);
    expect("error" in r).toBe(false);
    if (!("error" in r)) {
      expect(r.name).toBe("测试源");
      expect(r.level).toBe("B");
      expect(r.fetchIntervalSec).toBe(900);
    }
  });

  it("rejects private urls", () => {
    const r = parseSourceCreate({ ...base, url: "http://127.0.0.1/x" });
    expect("error" in r).toBe(true);
  });

  it("rejects bad enum", () => {
    const r = parseSourceCreate({ ...base, type: "nope" });
    expect("error" in r).toBe(true);
  });

  it("parses selectorConfig json string", () => {
    const r = parseSourceCreate({
      ...base,
      fetchStrategy: "html_list",
      selectorConfig: '{"listItem":"li","title":".t","url":"a"}',
    });
    expect("error" in r).toBe(false);
    if (!("error" in r)) {
      expect(r.selectorConfig).toEqual({ listItem: "li", title: ".t", url: "a" });
    }
  });
});

describe("parseSourcePatch", () => {
  it("requires at least one field", () => {
    expect(parseSourcePatch({})).toEqual({ error: "无有效更新字段" });
  });

  it("allows clearing selectorConfig", () => {
    const r = parseSourcePatch({ selectorConfig: null });
    expect("error" in r).toBe(false);
    if (!("error" in r)) expect(r.selectorConfig).toBeNull();
  });
});
