import { describe, it, expect } from "vitest";
import { publicEventStatuses, PUBLIC_PUBLISHED_STATUSES } from "../src/publicStatus";

describe("publicEventStatuses", () => {
  it("defaults to published only (no draft)", () => {
    expect([...publicEventStatuses()]).toEqual([...PUBLIC_PUBLISHED_STATUSES]);
    expect(publicEventStatuses(false)).not.toContain("draft_ai");
  });
  it("includes draft_ai when showDraft is true", () => {
    expect(publicEventStatuses(true)).toContain("draft_ai");
    expect(publicEventStatuses(true)).toContain("auto_published");
  });
});
