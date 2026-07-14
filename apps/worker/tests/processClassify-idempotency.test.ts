import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  analyze: vi.fn(),
}));

vi.mock("@aniradar/db", () => ({
  prisma: { signal: { findUnique: mocks.findUnique } },
  enqueueJob: vi.fn(),
  jobKeys: { compose: vi.fn() },
  workKeyFromFacts: vi.fn(),
}));
vi.mock("@aniradar/ai", () => ({
  analyze: mocks.analyze,
  isAiConfigured: () => false,
  looksNonNews: () => false,
}));
import { processClassify } from "../src/processClassify";

describe("processClassify idempotency", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not analyze or mutate a signal that was already classified", async () => {
    mocks.findUnique.mockResolvedValue({ id: "sig1", status: "classified", source: {} });

    await processClassify({ signalId: "sig1" }, { attemptsMade: 1, maxAttempts: 3 });

    expect(mocks.analyze).not.toHaveBeenCalled();
  });
});
