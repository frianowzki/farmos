import "server-only";
import { guardedFetch } from "./ssrf";
import { createPublicClient, formatUnits, getAddress, http, isAddress, parseAbiItem, type AbiFunction } from "viem";
import type { AirdropChecker } from "@/db/schema";
import { findChain, rpcFor } from "@/lib/chains";

type Result = NonNullable<AirdropChecker["lastRun"]>["results"][number];
const MAX_BYTES = 5 * 1024 * 1024;

function pick(obj: unknown, path?: string): unknown {
  if (!path) return obj;
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

/** Apply token decimals to raw integer amounts (wei-style strings/numbers). */
function scale(v: unknown, decimals?: number): unknown {
  if (decimals == null) return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return formatUnits(BigInt(v), decimals);
  if (typeof v === "string" && /^0x[0-9a-f]+$/i.test(v)) return formatUnits(BigInt(v), decimals);
  if (typeof v === "number" && Number.isSafeInteger(v)) return formatUnits(BigInt(v), decimals);
  return v;
}

function judge(v: unknown): Pick<Result, "status" | "amount"> {
  if (v == null || v === false || v === 0 || v === "0" || v === "" || (typeof v === "string" && /^(false|no|not.?eligible|ineligible)$/i.test(v))) return { status: "not_eligible", amount: null };
  if (v === true || (typeof v === "string" && /^(true|yes|eligible)$/i.test(v))) return { status: "eligible", amount: null };
  if (typeof v === "number" || (typeof v === "string" && /^\d+(\.\d+)?$/.test(v))) return Number(v) > 0 ? { status: "eligible", amount: String(v) } : { status: "not_eligible", amount: "0" };
  if (typeof v === "object") return { status: "eligible", amount: null };
  return { status: "eligible", amount: String(v).slice(0, 60) };
}

async function getJson(url: string) {
  const u = new URL(url);
  if (u.protocol !== "https:") throw new Error("Only https URLs");
  // User-supplied URL: block internal addresses on every hop and follow at most 3 redirects.
  const res = await guardedFetch(u.toString(), { headers: { accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(12_000) }, 3);
  if (res.status === 404) return { notFound: true as const };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) throw new Error("Response too large");
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error("Response too large");
  return { json: JSON.parse(text) as unknown };
}

export function validateChecker(c: Partial<AirdropChecker>): string | null {
  if (!c.type || !["api", "contract", "merkle", "page", "manual"].includes(c.type)) return "Pick a checker type";
  if (c.claimStatus && !["unknown", "upcoming", "open", "claimed", "closed"].includes(c.claimStatus)) return "Unknown claim status";
  if (c.type === "manual") return null;
  if (c.type === "page") {
    try {
      if (new URL(c.url ?? "").protocol !== "https:") return "URL must be https";
    } catch {
      return "Enter the claim or checker page URL";
    }
    if ((c.match ?? "").length > 120) return "Match text is too long";
    return null;
  }
  if (c.type === "api" || c.type === "merkle") {
    try {
      const u = new URL((c.url ?? "").replace("{address}", "0x0000000000000000000000000000000000000000"));
      if (u.protocol !== "https:") return "URL must be https";
    } catch {
      return "Enter a valid URL";
    }
    if (c.type === "api" && !c.url!.includes("{address}")) return "API URL needs an {address} placeholder";
  }
  if (c.type === "contract") {
    if (!c.chain || !findChain(c.chain)) return "Unknown chain";
    if (!c.address || !isAddress(c.address)) return "Enter the claim contract address";
    const fn = abiFn(c.fn ?? "");
    if (!fn) return "Signature like: claimable(address) returns (uint256)";
    if (fn.inputs.length !== 1 || fn.inputs[0].type !== "address") return "The view function must take exactly one address";
    if (fn.outputs.length < 1) return "The view function must return a value";
  }
  return null;
}

function abiFn(sig: string): AbiFunction | null {
  try {
    const s = sig.trim().replace(/^function\s+/, "");
    const withView = /\b(view|pure)\b/.test(s) ? s : s.replace(/\)\s*returns/, ") view returns");
    const item = parseAbiItem(`function ${withView}`) as AbiFunction;
    return item.type === "function" ? item : null;
  } catch {
    return null;
  }
}

/** Runs the configured read-only check for each EVM wallet. Never signs or sends anything. */
export async function runChecker(c: AirdropChecker, wallets: string[]): Promise<Result[]> {
  if (c.type === "page" || c.type === "manual") return [];
  const evm = [...new Set(wallets.filter((w) => isAddress(w)).map((w) => getAddress(w)))];
  if (!evm.length) return [];
  if (c.type === "api") {
    return Promise.all(
      evm.map(async (w) => {
        try {
          const r = await getJson(c.url!.replaceAll("{address}", w));
          if ("notFound" in r) return { wallet: w, status: "not_eligible" as const, amount: null, detail: "404 from checker" };
          return { wallet: w, ...judge(scale(pick(r.json, c.path), c.decimals)) };
        } catch (e) {
          return { wallet: w, status: "error" as const, detail: (e as Error).message.slice(0, 120) };
        }
      }),
    );
  }
  if (c.type === "merkle") {
    let data: unknown;
    try {
      const r = await getJson(c.url!);
      if ("notFound" in r) throw new Error("Claims file not found");
      data = pick(r.json, c.path);
    } catch (e) {
      return evm.map((w) => ({ wallet: w, status: "error" as const, detail: (e as Error).message.slice(0, 120) }));
    }
    // Accept {addr: amount|{amount}} maps or [{address|account, amount}] arrays.
    const map = new Map<string, unknown>();
    if (Array.isArray(data)) for (const row of data) { const a = (row?.address ?? row?.account ?? row?.wallet) as string | undefined; if (a) map.set(a.toLowerCase(), row?.amount ?? row?.value ?? true); }
    else if (data && typeof data === "object") for (const [k, v] of Object.entries(data as Record<string, unknown>)) map.set(k.toLowerCase(), v && typeof v === "object" && "amount" in (v as object) ? (v as { amount: unknown }).amount : v);
    return evm.map((w) => {
      if (!map.has(w.toLowerCase())) return { wallet: w, status: "not_eligible" as const, amount: null, detail: "Not in claims list" };
      const v = map.get(w.toLowerCase());
      const amt = scale(v, c.decimals);
      return { wallet: w, ...judge(amt === undefined ? true : amt) };
    });
  }
  // contract view
  const chain = findChain(c.chain!)!;
  const fn = abiFn(c.fn!)!;
  const client = createPublicClient({ chain: chain.chain, transport: http(rpcFor(chain.chain), { timeout: 12_000 }) });
  return Promise.all(
    evm.map(async (w) => {
      try {
        const out = await client.readContract({ address: getAddress(c.address!), abi: [fn], functionName: fn.name, args: [w] });
        const v: unknown = Array.isArray(out) ? (out as unknown[])[0] : out;
        const val = typeof v === "bigint" ? (c.decimals != null ? formatUnits(v, c.decimals) : String(v)) : v;
        return { wallet: w, ...judge(val) };
      } catch (e) {
        return { wallet: w, status: "error" as const, detail: ((e as { shortMessage?: string }).shortMessage ?? (e as Error).message).slice(0, 120) };
      }
    }),
  );
}
