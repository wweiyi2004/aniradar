import { describe, expect, it } from "vitest";
import { prepareEventRow, prepareSourceRow } from "../prisma/importTransform";

describe("PostgreSQL import transforms", () => {
  it("omits database-null JSON instead of writing JSON null", () => {
    expect(prepareSourceRow({ id: "s1", selectorConfig: null })).not.toHaveProperty("selectorConfig");
    expect(prepareEventRow({ id: "e1", facts: null })).not.toHaveProperty("facts");
  });

  it("derives the indexed work key from facts", () => {
    expect(prepareEventRow({ id: "e1", facts: { work: " ＡＮＩＭＥ " } }).workKey).toBe("anime");
  });
});
