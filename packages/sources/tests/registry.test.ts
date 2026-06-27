import { describe, it, expect } from "vitest";
import { getAdapter } from "../src/registry";

describe("getAdapter", () => {
  it("按 strategy 返回 adapter", () => {
    expect(getAdapter("rss")).toBeDefined();
    expect(getAdapter("youtube_rss")).toBeDefined();
    expect(getAdapter("html_list")).toBeDefined();
    expect(getAdapter("page_diff")).toBeDefined();
  });
});
