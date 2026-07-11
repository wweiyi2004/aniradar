import {
  SOURCE_TYPES,
  SOURCE_LEVELS,
  FETCH_STRATEGIES,
  validateSourceUrl,
  type SourceType,
  type SourceLevel,
  type FetchStrategy,
} from "@aniradar/shared";

export type ParsedSourceCreate = {
  name: string;
  url: string;
  type: SourceType;
  level: SourceLevel;
  fetchStrategy: FetchStrategy;
  fetchIntervalSec: number;
  enabled: boolean;
  selectorConfig?: unknown;
};

/** PATCH 时 selectorConfig 可为 null 表示清空。 */
export type ParsedSourcePatch = {
  name?: string;
  url?: string;
  type?: SourceType;
  level?: SourceLevel;
  fetchStrategy?: FetchStrategy;
  fetchIntervalSec?: number;
  enabled?: boolean;
  selectorConfig?: unknown | null;
};

function asEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T | { error: string } {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    return { error: `${field} 无效，允许: ${allowed.join(", ")}` };
  }
  return value as T;
}

function parseSelectorConfig(raw: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: undefined };
  if (typeof raw === "object" && !Array.isArray(raw)) return { ok: true, value: raw };
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return { ok: true, value: undefined };
    try {
      const parsed = JSON.parse(t);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return { ok: false, error: "selectorConfig 须为 JSON 对象" };
      }
      return { ok: true, value: parsed };
    } catch {
      return { ok: false, error: "selectorConfig JSON 解析失败" };
    }
  }
  return { ok: false, error: "selectorConfig 格式无效" };
}

function parseInterval(raw: unknown, fallback: number): number | { error: string } {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 60 || n > 86400 * 7) {
    return { error: "fetchIntervalSec 须为 60～604800 的整数（秒）" };
  }
  return n;
}

/** 校验创建 Source 的请求体。 */
export function parseSourceCreate(body: unknown): ParsedSourceCreate | { error: string } {
  if (!body || typeof body !== "object") return { error: "请求体无效" };
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name || name.length > 200) return { error: "name 必填且不超过 200 字" };

  const urlRes = validateSourceUrl(b.url);
  if (!urlRes.ok) return { error: urlRes.error };

  const type = asEnum(b.type, SOURCE_TYPES, "type");
  if (typeof type === "object") return type;
  const levelRaw = b.level ?? "B";
  const level = asEnum(levelRaw, SOURCE_LEVELS, "level");
  if (typeof level === "object") return level;
  const fetchStrategy = asEnum(b.fetchStrategy, FETCH_STRATEGIES, "fetchStrategy");
  if (typeof fetchStrategy === "object") return fetchStrategy;

  const interval = parseInterval(b.fetchIntervalSec, 900);
  if (typeof interval === "object") return interval;

  const sel = parseSelectorConfig(b.selectorConfig);
  if (!sel.ok) return { error: sel.error };

  const enabled = b.enabled === undefined ? true : Boolean(b.enabled);

  return {
    name,
    url: urlRes.url,
    type,
    level,
    fetchStrategy,
    fetchIntervalSec: interval,
    enabled,
    ...(sel.value !== undefined ? { selectorConfig: sel.value } : {}),
  };
}

/** 校验 PATCH Source 的请求体（仅更新提供的字段）。 */
export function parseSourcePatch(body: unknown): ParsedSourcePatch | { error: string } {
  if (!body || typeof body !== "object") return { error: "请求体无效" };
  const b = body as Record<string, unknown>;
  const out: ParsedSourcePatch = {};

  if ("name" in b) {
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name || name.length > 200) return { error: "name 必填且不超过 200 字" };
    out.name = name;
  }
  if ("url" in b) {
    const urlRes = validateSourceUrl(b.url);
    if (!urlRes.ok) return { error: urlRes.error };
    out.url = urlRes.url;
  }
  if ("type" in b) {
    const type = asEnum(b.type, SOURCE_TYPES, "type");
    if (typeof type === "object") return type;
    out.type = type;
  }
  if ("level" in b) {
    const level = asEnum(b.level, SOURCE_LEVELS, "level");
    if (typeof level === "object") return level;
    out.level = level;
  }
  if ("fetchStrategy" in b) {
    const fetchStrategy = asEnum(b.fetchStrategy, FETCH_STRATEGIES, "fetchStrategy");
    if (typeof fetchStrategy === "object") return fetchStrategy;
    out.fetchStrategy = fetchStrategy;
  }
  if ("fetchIntervalSec" in b) {
    const interval = parseInterval(b.fetchIntervalSec, 900);
    if (typeof interval === "object") return interval;
    out.fetchIntervalSec = interval;
  }
  if ("enabled" in b) {
    out.enabled = Boolean(b.enabled);
  }
  if ("selectorConfig" in b) {
    if (b.selectorConfig === null || b.selectorConfig === "") {
      out.selectorConfig = null; // Prisma: null 清空
    } else {
      const sel = parseSelectorConfig(b.selectorConfig);
      if (!sel.ok) return { error: sel.error };
      out.selectorConfig = sel.value ?? null;
    }
  }

  if (Object.keys(out).length === 0) return { error: "无有效更新字段" };
  return out;
}
