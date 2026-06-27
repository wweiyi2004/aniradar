import { describe, it, expect } from "vitest";
import { isTransientError, shouldRetry } from "../src/retry";

describe("isTransientError", () => {
  it("Prisma P1 连接类错误视为瞬时", () => {
    expect(isTransientError({ code: "P1001" })).toBe(true);
  });
  it("Prisma P2 数据类错误视为永久", () => {
    expect(isTransientError({ code: "P2002" })).toBe(false);
  });
  it("常见网络错误视为瞬时", () => {
    expect(isTransientError({ code: "ECONNRESET" })).toBe(true);
  });
  it("无 code 的错误视为瞬时", () => {
    expect(isTransientError(new Error("boom"))).toBe(true);
  });
  it("其它已知 code 视为永久", () => {
    expect(isTransientError({ code: "EXYZ" })).toBe(false);
  });
});

describe("shouldRetry", () => {
  const ctx = (attemptsMade: number, maxAttempts: number) => ({ attemptsMade, maxAttempts });
  it("瞬时错误且未到末次 → 重试", () => {
    expect(shouldRetry({ code: "P1001" }, ctx(0, 3))).toBe(true);
    expect(shouldRetry({ code: "P1001" }, ctx(1, 3))).toBe(true);
  });
  it("末次不再重试", () => {
    expect(shouldRetry({ code: "P1001" }, ctx(2, 3))).toBe(false);
  });
  it("永久错误不重试", () => {
    expect(shouldRetry({ code: "P2002" }, ctx(0, 3))).toBe(false);
  });
  it("无 ctx 不重试", () => {
    expect(shouldRetry({ code: "P1001" }, undefined)).toBe(false);
  });
});
