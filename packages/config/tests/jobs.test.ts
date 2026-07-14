import { afterEach, describe, expect, it } from "vitest";
import { env } from "../src/index";

const originalTimeout = process.env.CRAWLER_TIMEOUT_MS;
const originalPoll = process.env.JOB_POLL_INTERVAL_MS;

afterEach(() => {
  if (originalTimeout === undefined) delete process.env.CRAWLER_TIMEOUT_MS;
  else process.env.CRAWLER_TIMEOUT_MS = originalTimeout;
  if (originalPoll === undefined) delete process.env.JOB_POLL_INTERVAL_MS;
  else process.env.JOB_POLL_INTERVAL_MS = originalPoll;
});

describe("numeric config", () => {
  it("rejects invalid numeric settings instead of creating a hot loop", () => {
    process.env.CRAWLER_TIMEOUT_MS = "NaN";
    expect(() => env.crawlerTimeoutMs).toThrow("Invalid CRAWLER_TIMEOUT_MS");
  });

  it("enforces a minimum job polling interval", () => {
    process.env.JOB_POLL_INTERVAL_MS = "1";
    expect(() => env.jobPollIntervalMs).toThrow("Invalid JOB_POLL_INTERVAL_MS");
  });
});
