import { describe, it, expect } from "vitest";
import { mediumFromCategory } from "../src/medium";

describe("mediumFromCategory（mock 兜底规则）", () => {
  it("剧场版→film", () => expect(mediumFromCategory("movie_announced")).toBe("film"));
  it("BD/周边/活动→goods_event", () => {
    expect(mediumFromCategory("bd_release")).toBe("goods_event");
    expect(mediumFromCategory("merch_release")).toBe("goods_event");
    expect(mediumFromCategory("event_info")).toBe("goods_event");
  });
  it("放送/声优/PV 等动画动态→anime", () => {
    expect(mediumFromCategory("broadcast_date_announced")).toBe("anime");
    expect(mediumFromCategory("cast_announced")).toBe("anime");
    expect(mediumFromCategory("pv_released")).toBe("anime");
    expect(mediumFromCategory("anime_adaptation")).toBe("anime");
  });
  it("other→other", () => expect(mediumFromCategory("other")).toBe("other"));
});
