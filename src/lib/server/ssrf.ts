import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** True for loopback, private, link-local, CGNAT, multicast, reserved and unspecified addresses (v4 and v6). */
export function isPrivateIp(ip: string): boolean {
  let s = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = s.match(/^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/) ?? s.match(/^::(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) s = mapped[1];
  if (isIP(s) === 4) {
    const [a, b] = s.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (isIP(s) === 6) {
    if (s === "::" || s === "::1") return true;
    const head = parseInt(s.split(":")[0] || "0", 16);
    return (head & 0xfe00) === 0xfc00 /* fc00::/7 */ || (head & 0xffc0) === 0xfe80 /* link-local */ || (head & 0xff00) === 0xff00 /* multicast */ || s.startsWith("64:ff9b:") || s.startsWith("2001:db8:");
  }
  return true; // not an IP at all: refuse
}

/** Resolves the host and throws if any address is internal. */
export async function assertPublicUrl(raw: string | URL): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Only http(s) URLs are allowed");
  if (u.username || u.password) throw new Error("Credentials in URLs are not allowed");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) throw new Error("Private addresses are blocked");
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true, verbatim: true })).map((r) => r.address);
  if (!ips.length || ips.some(isPrivateIp)) throw new Error("Private addresses are blocked");
  return u;
}

/**
 * fetch() for user-supplied URLs: every hop is DNS-checked against private ranges and redirects are
 * followed by hand, at most `maxRedirects` times.
 */
export async function guardedFetch(raw: string, init: RequestInit = {}, maxRedirects = 3): Promise<Response> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; ; hop++) {
    const res = await fetch(url, { ...init, redirect: "manual" });
    if (res.status < 300 || res.status >= 400 || !res.headers.get("location")) return res;
    if (hop >= maxRedirects) throw new Error("Too many redirects");
    url = await assertPublicUrl(new URL(res.headers.get("location")!, url));
  }
}
