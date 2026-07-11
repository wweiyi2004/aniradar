import { getAdapter } from "@aniradar/sources";
import type { FetchStrategy } from "@aniradar/shared";
import { seedSources } from "./seedSources";

interface CheckResult {
  name: string;
  strategy: string;
  ok: boolean;
  count: number;
  message: string;
}

async function checkOne(source: (typeof seedSources)[number]): Promise<CheckResult> {
  try {
    const adapter = getAdapter(source.fetchStrategy as FetchStrategy);
    const result = await adapter.fetch({
      url: source.url,
      fetchStrategy: source.fetchStrategy as FetchStrategy,
      selectorConfig: source.selectorConfig,
    });
    const count = result.items.length;
    const ok = source.fetchStrategy === "youtube_rss" || count > 0 || result.notModified === true;
    return {
      name: source.name,
      strategy: source.fetchStrategy,
      ok,
      count,
      message: result.notModified
        ? "not modified"
        : source.fetchStrategy === "youtube_rss"
          ? `${count} relevant videos`
          : `${count} items`,
    };
  } catch (e) {
    return {
      name: source.name,
      strategy: source.fetchStrategy,
      ok: false,
      count: 0,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

async function main() {
  const results: CheckResult[] = [];
  for (const source of seedSources) {
    const result = await checkOne(source);
    results.push(result);
    const mark = result.ok ? "OK" : "FAIL";
    console.log(`[${mark}] ${result.name} (${result.strategy}) - ${result.message}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`checked ${results.length} sources, ${failed.length} failed`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
