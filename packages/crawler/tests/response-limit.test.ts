import { Response } from "undici";
import { describe, expect, it } from "vitest";
import { readTextLimited } from "../src/index";

describe("crawler response limit", () => {
  it("reads a body within the byte limit", async () => {
    await expect(readTextLimited(new Response("hello"), 5)).resolves.toBe("hello");
  });

  it("rejects a streamed body once it exceeds the byte limit", async () => {
    await expect(readTextLimited(new Response("123456"), 5)).rejects.toThrow("response too large");
  });

  it("rejects an oversized declared content-length before reading", async () => {
    const response = new Response("x", { headers: { "content-length": "100" } });
    await expect(readTextLimited(response, 5)).rejects.toThrow("response too large");
  });
});
