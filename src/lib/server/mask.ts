import "server-only";

/**
 * Masked preview of a secret: a short, non-secret prefix (sk-, sk_live_, ghp_…) and the
 * last 4 characters. Short values are fully masked. The full value never leaves the server.
 */
export function maskSecret(v: string | null | undefined): string | null {
  const s = v?.trim();
  if (!s) return null;
  if (s.length < 16) return "••••••••";
  // Only well-known, non-secret vendor prefixes are kept; anything else is masked from the start.
  const prefix = s.match(/^(sk-proj-|sk-or-v1-|sk-ant-|sk_live_|sk_test_|sk-|ghp_|gho_|github_pat_|xoxb-|re_|vercel_blob_rw_)/)?.[1] ?? "";
  return `${prefix}${"•".repeat(12)}${s.slice(-4)}`;
}
