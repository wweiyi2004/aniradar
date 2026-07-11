import { describe, it, expect } from "vitest";
import { validateSourceUrl, isBlockedIpv4, isBlockedIpv6Literal } from "../src/url";

describe("isBlockedIpv4", () => {
  it("blocks private and loopback ranges", () => {
    expect(isBlockedIpv4("127.0.0.1")).toBe(true);
    expect(isBlockedIpv4("10.0.0.1")).toBe(true);
    expect(isBlockedIpv4("192.168.1.1")).toBe(true);
    expect(isBlockedIpv4("172.16.0.1")).toBe(true);
    expect(isBlockedIpv4("169.254.169.254")).toBe(true);
    expect(isBlockedIpv4("0.0.0.0")).toBe(true);
    expect(isBlockedIpv4("100.64.0.1")).toBe(true);
  });
  it("allows public addresses", () => {
    expect(isBlockedIpv4("8.8.8.8")).toBe(false);
    expect(isBlockedIpv4("1.1.1.1")).toBe(false);
  });
});

describe("isBlockedIpv6Literal", () => {
  it("blocks loopback and ULA", () => {
    expect(isBlockedIpv6Literal("::1")).toBe(true);
    expect(isBlockedIpv6Literal("[::1]")).toBe(true);
    expect(isBlockedIpv6Literal("fe80::1")).toBe(true);
    expect(isBlockedIpv6Literal("fd00::1")).toBe(true);
  });
});

describe("validateSourceUrl", () => {
  it("accepts normal https news urls", () => {
    const r = validateSourceUrl("https://animeanime.jp/rss/index.xml");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url).toMatch(/^https:\/\//);
  });
  it("rejects non-http schemes", () => {
    expect(validateSourceUrl("file:///etc/passwd").ok).toBe(false);
    expect(validateSourceUrl("ftp://example.com/a").ok).toBe(false);
  });
  it("rejects localhost and private ips", () => {
    expect(validateSourceUrl("http://localhost/admin").ok).toBe(false);
    expect(validateSourceUrl("http://127.0.0.1:8080/").ok).toBe(false);
    expect(validateSourceUrl("http://192.168.0.1/").ok).toBe(false);
    expect(validateSourceUrl("http://169.254.169.254/latest/meta-data/").ok).toBe(false);
  });
  it("rejects embedded credentials", () => {
    expect(validateSourceUrl("https://user:pass@example.com/x").ok).toBe(false);
  });
  it("rejects empty / invalid", () => {
    expect(validateSourceUrl("").ok).toBe(false);
    expect(validateSourceUrl("not a url").ok).toBe(false);
    expect(validateSourceUrl(null).ok).toBe(false);
  });
});
