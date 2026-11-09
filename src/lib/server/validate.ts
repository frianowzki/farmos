import "server-only";
import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
const money = z.coerce.number().finite().optional();
const strList = z.array(z.string().trim().max(200)).max(60).optional();

export const projectInput = z
  .object({
    name: z.string().trim().min(1).max(200),
    category: z.enum(["airdrop", "testnet", "nft", "degen"]),
    status: z.enum(["research", "active", "waiting", "claimable", "done", "dropped"]),
    chains: strList,
    links: z.record(z.string(), z.string().trim().max(500)).optional(),
    wallets: strList,
    tags: strList,
    priority: z.enum(["low", "medium", "high", "urgent"]),
    tier: z.enum(["S", "A", "B", "C"]),
    risk: z.enum(["low", "medium", "high", "extreme"]),
    source: z.string().max(500).nullable(),
    referral: z.string().max(500).nullable(),
    deadline: day,
    keyDates: z
      .object({ snapshot: day, tge: day, mint: day, claimStart: day, claimEnd: day })
      .partial()
      .optional(),
    costSpent: money,
    capitalDeployed: money,
    rewardsReceived: money,
    rewardsNote: z.string().max(500).nullable(),
    mailMatchers: strList,
    summary: z.string().max(1000).nullable(),
    notes: z.string().max(400_000),
    pinned: z.boolean(),
  })
  .partial();

export const positionInput = z
  .object({
    projectId: z.string().uuid(),
    token: z.string().trim().min(1).max(80),
    chain: z.string().max(60).nullable(),
    tokenAddress: z.string().max(120).nullable(),
    size: z.coerce.number().finite(),
    entryPrice: z.coerce.number().finite(),
    exitPrice: z.coerce.number().finite().nullable(),
    currentPrice: z.coerce.number().finite().nullable(),
    status: z.enum(["open", "closed"]),
    openedAt: day,
    closedAt: day,
    note: z.string().max(2000).nullable(),
  })
  .partial();

export const taskInput = z
  .object({
    projectId: z.string().uuid().nullable(),
    title: z.string().trim().min(1).max(300),
    cadence: z.enum(["daily", "weekly", "custom"]),
    intervalDays: z.coerce.number().int().min(1).max(365),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    url: z.string().max(500).nullable(),
    active: z.boolean(),
    sortOrder: z.number().int(),
  })
  .partial();

export const diaryInput = z
  .object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z.string().max(300),
    content: z.string().max(400_000),
    projectIds: z.array(z.string().uuid()).max(50),
  })
  .partial();

export function clean<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
