import { describe, it, expect } from "vitest";
import { youtubeId } from "../lib/youtube";

describe("youtubeId", () => {
  it("解析 watch?v=", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=KZhL6CYGYU0")).toBe("KZhL6CYGYU0");
  });
  it("解析 youtu.be 短链", () => {
    expect(youtubeId("https://youtu.be/KZhL6CYGYU0")).toBe("KZhL6CYGYU0");
  });
  it("解析 embed / shorts 路径", () => {
    expect(youtubeId("https://www.youtube.com/embed/abc123")).toBe("abc123");
    expect(youtubeId("https://www.youtube.com/shorts/xyz789")).toBe("xyz789");
  });
  it("非 YouTube / 空 → null", () => {
    expect(youtubeId("https://example.com/v/1")).toBeNull();
    expect(youtubeId(null)).toBeNull();
    expect(youtubeId("not a url")).toBeNull();
  });
});
