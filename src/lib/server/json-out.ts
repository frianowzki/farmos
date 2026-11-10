import "server-only";

/** Pull the first JSON object/array out of a model reply (tolerates code fences and prose around it). */
export function extractJson<T = unknown>(text: string, kind: "object" | "array" = "object"): T | null {
  const t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const [o, c] = kind === "object" ? ["{", "}"] : ["[", "]"];
  const a = t.indexOf(o);
  const b = t.lastIndexOf(c);
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(t.slice(a, b + 1)) as T;
  } catch {
    return null;
  }
}
