import { fetch, Agent } from "undici";
import { lookup as dnsLookup } from "node:dns";
import type { LookupAddress, LookupFunction } from "node:net";
import { describe, expect, it } from "vitest";

// 复刻仓库 safeLookup 的关键行为：先解析全部地址做 SSRF 校验，再按调用方
// 期望的形状回调。all=true 时必须回数组，否则 Node 22 autoSelectFamily
// 路径抛 ERR_INVALID_IP_ADDRESS。
function buildLookup(): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { ...options, all: true, verbatim: true }, (error, result) => {
      if (error) return callback(error, "", 0);
      const addresses = Array.isArray(result) ? result : [{ address: result, family: 0 }];
      if (options && options.all) return callback(null, addresses as LookupAddress[]);
      const selected = addresses[0];
      if (!selected) return callback(new Error("no address"), "", 0);
      callback(null, selected.address, selected.family);
    });
  };
}

describe("safeLookup callback contract", () => {
  it("returns an address array when the caller asks for all", async () => {
    const lookup = buildLookup();
    const addresses = await new Promise<LookupAddress[]>((resolve, reject) => {
      lookup("localhost", { all: true, family: 0 } as never, (err, res) => {
        if (err) reject(err);
        else resolve(Array.isArray(res) ? (res as LookupAddress[]) : []);
      });
    });
    expect(addresses.length).toBeGreaterThan(0);
    expect(typeof addresses[0].address).toBe("string");
    expect([4, 6]).toContain(addresses[0].family);
  });

  it("returns a single address when all is not requested", async () => {
    const lookup = buildLookup();
    const single = await new Promise<string>((resolve, reject) => {
      lookup("localhost", { family: 0 } as never, (err, address) => {
        if (err) reject(err);
        else resolve(String(address));
      });
    });
    expect(single).toMatch(/^(127\.|::1)/);
  });

  it("connects through an Agent using the lookup (Happy Eyeballs path)", async () => {
    const agent = new Agent({ connect: { timeout: 10_000, lookup: buildLookup() } });
    const res = await fetch("https://registry.npmmirror.com/", {
      dispatcher: agent,
      signal: AbortSignal.timeout(15_000),
    });
    expect(res.status).toBe(200);
    await res.body?.cancel();
  });
});
