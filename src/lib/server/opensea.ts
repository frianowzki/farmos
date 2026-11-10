import "server-only";
import { createPublicClient, getAddress, http, isAddress, keccak256, parseAbi, parseAbiItem, type Address, type Hex } from "viem";
import { findChain, rpcFor } from "@/lib/chains";
import { safeFetch } from "./ai";

/** OpenSea Drops API (read-only). Key stays server-side; nothing here builds or sends a transaction. */
const API = "https://api.opensea.io/api/v2";
export const openseaConfigured = () => Boolean(process.env.OPENSEA_API_KEY?.trim());

import type { Drop, DropDetail, DropRich, DropStage, Eligibility, StageCheck, Verdict, WalletCheck } from "./opensea-types";
export type { Drop, DropDetail, DropRich, DropStage, Eligibility, StageCheck, Verdict, WalletCheck };

async function os<T>(path: string, revalidate = 600): Promise<T> {
  const key = process.env.OPENSEA_API_KEY?.trim();
  if (!key) throw new Error("OPENSEA_API_KEY is not set");
  const res = await fetch(`${API}${path}`, { headers: { "x-api-key": key, accept: "application/json" }, next: { revalidate } });
  if (!res.ok) throw new Error(res.status === 429 ? "OpenSea rate limit, try again in a minute" : `OpenSea returned ${res.status}`);
  return (await res.json()) as T;
}

export async function listDrops(type: "upcoming" | "featured" | "recently_minted" = "upcoming", limit = 50, pages = 4) {
  const out: Drop[] = [];
  let next: string | null = null;
  for (let i = 0; i < pages; i++) {
    const r: { drops: Drop[]; next?: string | null } = await os(`/drops?type=${type}&limit=${limit}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
    out.push(...(r.drops ?? []));
    next = r.next ?? null;
    if (!next) break;
  }
  return out;
}

type Collection = { description?: string; banner_image_url?: string; project_url?: string; discord_url?: string; telegram_url?: string; twitter_username?: string | null; safelist_status?: string };

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  }));
  return out;
}

/**
 * Every drop OpenSea lists (upcoming, featured, recently minted; all pages), each merged with its
 * drop detail (supply, every stage) and collection profile (description, banner, links).
 */
export async function listDropsRich(max = 80): Promise<DropRich[]> {
  const kinds = ["upcoming", "featured", "recently_minted"] as const;
  const lists = await Promise.all(kinds.map((k) => listDrops(k).catch(() => [] as Drop[])));
  const bySlug = new Map<string, { d: Drop; kinds: DropRich["kinds"] }>();
  lists.forEach((l, i) => l.forEach((d) => {
    const e = bySlug.get(d.collection_slug);
    if (e) e.kinds.push(kinds[i]);
    else bySlug.set(d.collection_slug, { d, kinds: [kinds[i]] });
  }));
  const items = [...bySlug.values()].slice(0, max);
  return pool(items, 6, async ({ d, kinds: k }) => {
    const [det, col] = await Promise.all([
      os<DropDetail>(`/drops/${encodeURIComponent(d.collection_slug)}`, 600).catch(() => null),
      os<Collection>(`/collections/${encodeURIComponent(d.collection_slug)}`, 3600).catch(() => null),
    ]);
    const stages = [...(det?.stages ?? [])].sort((a, b) => a.start_time.localeCompare(b.start_time));
    const pub = stages.find((s) => /public/i.test(s.stage_type)) ?? null;
    return {
      ...d,
      kinds: k,
      max_supply: det?.max_supply ?? null,
      total_supply: det?.total_supply ?? null,
      stage_count: stages.length,
      first_start: stages[0]?.start_time ?? null,
      last_end: stages.at(-1)?.end_time ?? null,
      public_price: pub?.price ?? null,
      price_currency_address: pub?.price_currency_address ?? null,
      description: col?.description?.trim() || null,
      banner_image_url: col?.banner_image_url || null,
      links: {
        x: col?.twitter_username ? `https://x.com/${col.twitter_username}` : null,
        site: col?.project_url || null,
        discord: col?.discord_url || null,
        telegram: col?.telegram_url || null,
      },
      safelist: col?.safelist_status ?? null,
    };
  });
}

export const getDrop = (slug: string) => os<DropDetail>(`/drops/${encodeURIComponent(slug)}`, 300);

/**
 * OpenSea's own allowlist check for the stage that is live right now. Asks OpenSea to *build* a 1-token mint for
 * the wallet (API key only, no wallet auth, no signature) and reads only the verdict: 200 = eligible,
 * 422 MINTER_NOT_ELIGIBLE = not on the list, 409 = no live stage. The calldata is discarded; nothing is signed or sent.
 */
export async function openseaActiveStageCheck(slug: string, minter: string): Promise<{ verdict: Verdict | null; stageUuid?: string; message?: string }> {
  const key = process.env.OPENSEA_API_KEY?.trim();
  if (!key) return { verdict: null };
  const res = await fetch(`${API}/drops/${encodeURIComponent(slug)}/mint`, {
    method: "POST",
    headers: { "x-api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ minter, quantity: 1, skip_balance_check: true }),
    cache: "no-store",
  });
  const j = (await res.json().catch(() => ({}))) as { stage_uuid?: string; code?: string; errors?: string[] };
  if (res.ok) return { verdict: "eligible", stageUuid: j.stage_uuid };
  const message = j.errors?.[0]?.slice(0, 200);
  if (res.status === 422 && j.code === "MINTER_NOT_ELIGIBLE") return { verdict: "not_eligible", message };
  if (res.status === 422) return { verdict: "eligible", message }; // on the list, but over limit / supply
  return { verdict: null, message };
}

// ---------------- eligibility (read-only, no signatures) ----------------

/** SeaDrop v1 singleton, same address on every chain OpenSea supports. */
const SEADROP = "0x00005EA00Ac477B1030CE78506496e8C2dE24bf5" as const;
const SEADROP_ABI = parseAbi([
  "function getAllowListMerkleRoot(address nftContract) view returns (bytes32)",
  "function getTokenGatedAllowedTokens(address nftContract) view returns (address[])",
]);
const ERC721 = parseAbi(["function balanceOf(address owner) view returns (uint256)"]);
const ALLOWLIST_EVENT = parseAbiItem("event AllowListUpdated(address indexed nftContract, bytes32 indexed previousMerkleRoot, bytes32 indexed newMerkleRoot, string[] publicKeyURI, string allowListURI)");


const ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000";

function ipfs(u: string) {
  if (u.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${u.slice(7).replace(/^ipfs\//, "")}`;
  return u;
}

import { merkleRoot, seadropLeaf, type Row } from "@/lib/merkle";

async function allowListUri(chainId: number, client: ReturnType<typeof createPublicClient>, nft: Address): Promise<string | null> {
  const key = process.env.ETHERSCAN_API_KEY?.trim();
  if (key) {
    const topic0 = "0x" + keccak256(new TextEncoder().encode("AllowListUpdated(address,bytes32,bytes32,string[],string)")).slice(2);
    const topic1 = "0x" + nft.slice(2).toLowerCase().padStart(64, "0");
    const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=logs&action=getLogs&fromBlock=0&toBlock=latest&address=${SEADROP}&topic0=${topic0}&topic0_1_opr=and&topic1=${topic1}&apikey=${key}`;
    const r = (await (await fetch(url, { cache: "no-store" })).json()) as { result?: { data: Hex; topics: Hex[] }[] };
    if (Array.isArray(r.result) && r.result.length) {
      const { decodeEventLog } = await import("viem");
      const last = r.result[r.result.length - 1];
      const ev = decodeEventLog({ abi: [ALLOWLIST_EVENT], data: last.data, topics: last.topics as [Hex, ...Hex[]] });
      return (ev.args as { allowListURI: string }).allowListURI || null;
    }
  }
  // Fallback: ask the RPC for the recent window (public RPCs cap ranges).
  const latest = await client.getBlockNumber();
  const logs = await client.getLogs({ address: SEADROP, event: ALLOWLIST_EVENT, args: { nftContract: nft }, fromBlock: latest > BigInt(49000) ? latest - BigInt(49000) : BigInt(0), toBlock: latest });
  return logs.length ? (logs[logs.length - 1].args.allowListURI ?? null) : null;
}

const isPublic = (s: DropStage) => /public/i.test(s.stage_type);
const isTokenGated = (s: DropStage) => /token/i.test(s.stage_type);
const isSigned = (s: DropStage) => /signed/i.test(s.stage_type);

export async function checkEligibility(drop: DropDetail, wallets: { address: string; label: string }[]): Promise<Eligibility> {
  const evm = wallets.filter((w) => isAddress(w.address));
  const c = findChain(drop.chain);
  const out: Eligibility = { checkedAt: new Date().toISOString(), chainSupported: Boolean(c), merkle: { root: null, listUri: null, listSize: null, rootVerified: null }, wallets: [] };
  const seadrop = /seadrop_v1/i.test(drop.drop_type) && isAddress(drop.contract_address);
  const client = c ? createPublicClient({ chain: c.chain, transport: http(rpcFor(c.chain), { timeout: 12_000 }) }) : null;
  const nft = isAddress(drop.contract_address) ? getAddress(drop.contract_address) : null;

  // Merkle allowlist: on-chain root + the list SeaDrop published with it.
  let members: Set<string> | null = null;
  const needsMerkle = drop.stages.some((s) => !isPublic(s) && !isTokenGated(s) && !isSigned(s));
  if (client && nft && seadrop && needsMerkle) {
    try {
      const root = await client.readContract({ address: SEADROP, abi: SEADROP_ABI, functionName: "getAllowListMerkleRoot", args: [nft] });
      out.merkle.root = root === ZERO ? null : root;
      if (out.merkle.root) {
        const uri = await allowListUri(c!.chain.id, client, nft);
        out.merkle.listUri = uri;
        if (uri) {
          const r = await safeFetch(ipfs(uri), 20_000_000, 20_000);
          const rows = JSON.parse(r.text) as Row[] | { allowList?: Row[]; list?: Row[] };
          const list = Array.isArray(rows) ? rows : (rows.allowList ?? rows.list ?? []);
          out.merkle.listSize = list.length;
          members = new Set(list.map((x) => String(x.address ?? x.minter ?? x.wallet ?? "").toLowerCase()).filter(Boolean));
          const leaves = list.map(seadropLeaf).filter((x): x is Hex => Boolean(x));
          out.merkle.rootVerified = leaves.length === list.length ? merkleRoot(leaves) === out.merkle.root.toLowerCase() : null;
        } else out.merkle.note = "Merkle root is set on-chain but the allowlist file was not found in recent logs.";
      }
    } catch (e) {
      out.merkle.note = `On-chain allowlist read failed: ${(e as Error).message.slice(0, 140)}`;
    }
  }

  let gated: Address[] = [];
  if (client && nft && seadrop && drop.stages.some(isTokenGated)) {
    try {
      gated = [...(await client.readContract({ address: SEADROP, abi: SEADROP_ABI, functionName: "getTokenGatedAllowedTokens", args: [nft] }))];
    } catch {
      gated = [];
    }
  }

  const live = drop.active_stage?.uuid;
  for (const w of evm) {
    const stages: StageCheck[] = [];
    const osCheck = live && /seadrop_v1/i.test(drop.drop_type) ? await openseaActiveStageCheck(drop.collection_slug, w.address).catch(() => ({ verdict: null }) as { verdict: null }) : null;
    for (const s of drop.stages) {
      const stage = s.label || s.stage_type;
      if (osCheck?.verdict && s.uuid === live && !isPublic(s)) stages.push({ stage, type: s.stage_type, verdict: osCheck.verdict, how: `OpenSea allowlist check for the live stage: ${osCheck.verdict === "eligible" ? "wallet is on the list" : "wallet is not on the list"}` });
      else if (isPublic(s)) stages.push({ stage, type: s.stage_type, verdict: "eligible", how: "Public stage, open to every wallet" });
      else if (isSigned(s)) stages.push({ stage, type: s.stage_type, verdict: "unknown", how: "Signed presale: OpenSea answers for a wallet only once this stage is live (farmOS re-checks then). Before that, check on OpenSea; farmOS never asks for signatures" });
      else if (isTokenGated(s)) {
        if (!client || !gated.length) stages.push({ stage, type: s.stage_type, verdict: "unknown", how: "Token-gated, gate tokens not readable on-chain" });
        else {
          let held = false;
          for (const t of gated) {
            try {
              if ((await client.readContract({ address: t, abi: ERC721, functionName: "balanceOf", args: [getAddress(w.address)] })) > BigInt(0)) held = true;
            } catch {}
          }
          stages.push({ stage, type: s.stage_type, verdict: held ? "eligible" : "not_eligible", how: `Token-gated: ${held ? "holds" : "does not hold"} a gate token on-chain` });
        }
      } else if (members) {
        const inList = members.has(w.address.toLowerCase());
        stages.push({ stage, type: s.stage_type, verdict: inList ? "eligible" : "not_eligible", how: `Allowlist file ${out.merkle.rootVerified ? "matches the on-chain Merkle root" : "published with the on-chain root"}: ${inList ? "listed" : "not listed"}` });
      } else stages.push({ stage, type: s.stage_type, verdict: "unknown", how: out.merkle.note ?? (c ? "No public allowlist data for this stage" : `Chain ${drop.chain} not supported for on-chain reads`) });
    }
    const gatedStages = stages.filter((x) => !/public/i.test(x.type));
    const verdict: Verdict = gatedStages.some((x) => x.verdict === "eligible") ? "eligible" : gatedStages.length && gatedStages.every((x) => x.verdict === "not_eligible") ? "not_eligible" : stages.some((x) => x.verdict === "eligible") && !gatedStages.length ? "eligible" : "unknown";
    out.wallets.push({ address: w.address, label: w.label, verdict, stages });
  }
  return out;
}
