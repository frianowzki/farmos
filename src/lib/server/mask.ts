import "server-only";

/**
 * Masked preview of a secret: a short, non-secret prefix (sk-, sk_live_, ghp_…) and the
 * last 4 characters. Short values are fully masked. The full value never leaves the server.
 */
export function maskSecret(v: string | null | undefined): string | null {
  const s = v?.trim();
  if (!s) return null;
  if (s.length < 16) return "••••••••";
  const prefix = s.match(/^([a-z]{2,4}[-_](?:live_|test_|proj-)?)/i)?.[1] ?? "";
  return `${prefix}${"•".repeat(12)}${s.slice(-4)}`;
}
