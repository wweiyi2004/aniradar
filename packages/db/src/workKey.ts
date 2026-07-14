export function normalizeWorkKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return normalized || null;
}

export function workKeyFromFacts(facts: unknown): string | null {
  if (!facts || typeof facts !== "object" || Array.isArray(facts)) return null;
  return normalizeWorkKey((facts as Record<string, unknown>).work);
}
