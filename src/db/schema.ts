import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export type ProjectLinks = {
  site?: string;
  x?: string;
  discord?: string;
  telegram?: string;
  docs?: string;
  explorer?: string;
  galxe?: string;
  other?: string;
};

export type KeyDates = {
  snapshot?: string | null;
  tge?: string | null;
  mint?: string | null;
  claimStart?: string | null;
  claimEnd?: string | null;
  /** Optional wall-clock times ("HH:mm", 24h) for the dates above, in the profile's time zone. */
  times?: Partial<Record<"snapshot" | "tge" | "mint" | "claimStart" | "claimEnd", string | null>>;
};

/** AI-suggested review of a project's audit/rating (suggestion only; the user accepts it). */
export type AiReview = {
  rating: number;
  score: number;
  tier?: "S" | "A" | "B" | "C" | null;
  risk?: "low" | "medium" | "high" | "extreme" | null;
  verdict: string;
  summary: string;
  reasons: { kind: "pro" | "con" | "unknown"; text: string }[];
  sources: { title: string; url: string }[];
  answers: Record<string, string[]>;
  model?: string;
  at: string;
};

export type ProjectAudit = {
  answers: Record<string, string[]>;
  score: number;
  updatedAt: string;
  ai?: AiReview | null;
};

/** Read-only airdrop eligibility checker configured per project. */
export type ClaimStatus = "unknown" | "upcoming" | "open" | "claimed" | "closed";

export type AirdropChecker = {
  /** page: a claim/checker page watched for going live; manual: status set by hand only. */
  type: "api" | "contract" | "merkle" | "page" | "manual";
  /** page: optional text that must appear on the page for the claim to count as open. */
  match?: string;
  /** Manual claim status (any type). "open"/"claimed"/"closed" override what the checks infer. */
  claimStatus?: ClaimStatus;
  /** Let the cron run this check and alert on Telegram (default on). */
  autoCheck?: boolean;
  /** Alert state so each event is sent once: when the page went live, wallets already announced. */
  alerts?: { openAt?: string | null; eligible?: string[] } | null;
  /** api: https URL with {address}; merkle: https URL of a JSON claims list */
  url?: string;
  /** api/merkle: dot path to the amount or eligibility field, e.g. "amount" or "data.eligible" */
  path?: string;
  /** contract: chain key (see lib/chains) + address + view signature taking one address, e.g. "claimable(address) returns (uint256)" */
  chain?: string;
  address?: string;
  fn?: string;
  decimals?: number;
  claimUrl?: string;
  lastRun?: {
    at: string;
    results: { wallet: string; status: "eligible" | "not_eligible" | "error"; amount?: string | null; detail?: string }[];
  } | null;
};

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Which farmOS profile owns the row ("default" = Iya). Always set explicitly; scoped in every query. */
    profileId: text("profile_id").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull().default("airdrop"),
    status: text("status").notNull().default("research"),
    chains: text("chains").array().notNull().default([]),
    links: jsonb("links").$type<ProjectLinks>().notNull().default({}),
    wallets: text("wallets").array().notNull().default([]),
    tags: text("tags").array().notNull().default([]),
    priority: text("priority").notNull().default("medium"),
    tier: text("tier").notNull().default("B"),
    risk: text("risk").notNull().default("medium"),
    /** Airdrop eligibility: unknown | checking | eligible | not_eligible (set by hand or by the checker). */
    eligibility: text("eligibility").notNull().default("unknown"),
    source: text("source"),
    referral: text("referral"),
    deadline: date("deadline"),
    keyDates: jsonb("key_dates").$type<KeyDates>().notNull().default({}),
    costSpent: doublePrecision("cost_spent").notNull().default(0),
    capitalDeployed: doublePrecision("capital_deployed").notNull().default(0),
    rewardsReceived: doublePrecision("rewards_received").notNull().default(0),
    rewardsNote: text("rewards_note"),
    mailMatchers: text("mail_matchers").array().notNull().default([]),
    summary: text("summary"),
    notes: text("notes").notNull().default(""),
    pinned: boolean("pinned").notNull().default(false),
    rating: integer("rating").notNull().default(0),
    accent: text("accent"),
    campaignStart: date("campaign_start"),
    campaignEnd: date("campaign_end"),
    audit: jsonb("audit").$type<ProjectAudit | null>(),
    checker: jsonb("checker").$type<AirdropChecker | null>(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("projects_category_idx").on(t.category), index("projects_status_idx").on(t.status)],
);

export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Which farmOS profile owns the row ("default" = Iya). Always set explicitly; scoped in every query. */
    profileId: text("profile_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    chain: text("chain"),
    tokenAddress: text("token_address"),
    size: doublePrecision("size").notNull().default(0),
    entryPrice: doublePrecision("entry_price").notNull().default(0),
    exitPrice: doublePrecision("exit_price"),
    currentPrice: doublePrecision("current_price"),
    status: text("status").notNull().default("open"),
    openedAt: date("opened_at"),
    closedAt: date("closed_at"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    priceUpdatedAt: timestamp("price_updated_at", { withTimezone: true }),
  },
  (t) => [index("positions_project_idx").on(t.projectId)],
);

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Which farmOS profile owns the row ("default" = Iya). Always set explicitly; scoped in every query. */
  profileId: text("profile_id").notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  cadence: text("cadence").notNull().default("daily"),
  intervalDays: integer("interval_days").notNull().default(1),
  weekdays: integer("weekdays").array().notNull().default([]),
  startDate: date("start_date").notNull(),
  url: text("url"),
  active: boolean("active").notNull().default(true),
  /** Include in the Telegram digest when still open (per task). */
  remind: boolean("remind").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const taskCompletions = pgTable(
  "task_completions",
  {
    /** Which farmOS profile owns the row ("default" = Iya). Always set explicitly; scoped in every query. */
    profileId: text("profile_id").notNull(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.day] })],
);

export const diaryEntries = pgTable(
  "diary_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Which farmOS profile owns the row ("default" = Iya). Always set explicitly; scoped in every query. */
    profileId: text("profile_id").notNull(),
    day: date("day").notNull(),
    title: text("title").notNull().default(""),
    content: text("content").notNull().default(""),
    projectIds: uuid("project_ids").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("diary_day_idx").on(t.day)],
);

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Which farmOS profile owns the row ("default" = Iya). Always set explicitly; scoped in every query. */
    profileId: text("profile_id").notNull(),
    address: text("address").notNull(),
    label: text("label").notNull().default(""),
    /** Wallet app it lives in (metamask, rabby, phantom…), for the icon. Empty = unknown. */
    provider: text("provider").notNull().default(""),
    /** Address family: evm | solana | aptos | sui | zcash | near | canton. Empty = inferred from the address. */
    chain: text("chain").notNull().default(""),
    /** The profile's default wallet (at most one per profile; partial unique index). Preselected in pickers. */
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("wallets_profile_address_idx").on(t.profileId, t.address), uniqueIndex("wallets_profile_default_idx").on(t.profileId).where(sql`${t.isDefault}`)],
);

/** Key/value settings per profile. Shared caches (news wire…) live under profile "_global". */
export const settings = pgTable(
  "settings",
  {
    profileId: text("profile_id").notNull(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.key] })],
);

export const chatThreads = pgTable("chat_threads", {
  id: text("id").primaryKey(),
  /** Which farmOS profile owns the row ("default" = Iya). Always set explicitly; scoped in every query. */
  profileId: text("profile_id").notNull(),
  title: text("title").notNull().default("New chat"),
  mode: text("mode").notNull().default("chat"),
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const googleTokens = pgTable("google_tokens", {
  /** One Google account per profile: the row id equals the profile id. */
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull(),
  email: text("email").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: integer("expires_at"),
  scope: text("scope"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const calendarLinks = pgTable(
  "calendar_links",
  {
    /** Which farmOS profile owns the row ("default" = Iya). Always set explicitly; scoped in every query. */
    profileId: text("profile_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    eventId: text("event_id").notNull(),
    day: date("day").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.kind] })],
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Which farmOS profile owns the row ("default" = Iya). Always set explicitly; scoped in every query. */
    profileId: text("profile_id").notNull(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    diaryId: uuid("diary_id").references(() => diaryEntries.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    pathname: text("pathname").notNull(),
    name: text("name").notNull(),
    size: integer("size").notNull().default(0),
    contentType: text("content_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attachments_project_idx").on(t.projectId), index("attachments_diary_idx").on(t.diaryId)],
);

/** OAuth / login-widget identities linked from Settings → Connected accounts. Tokens are AES-GCM encrypted. */
export const connectedAccounts = pgTable("connected_accounts", {
  profileId: text("profile_id").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  username: text("username"),
  name: text("name"),
  image: text("image"),
  accessTokenEnc: text("access_token_enc"),
  refreshTokenEnc: text("refresh_token_enc"),
  expiresAt: integer("expires_at"),
  scope: text("scope"),
  profile: jsonb("profile").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.profileId, t.provider] })]);

/** Daily AI-picked reading list (news, early projects). Generated on demand from real sources. */
export const feedItems = pgTable(
  "feed_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Which farmOS profile owns the row ("default" = Iya). Always set explicitly; scoped in every query. */
    profileId: text("profile_id").notNull(),
    day: date("day").notNull(),
    kind: text("kind").notNull().default("news"),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    url: text("url"),
    source: text("source"),
    category: text("category"),
    score: integer("score").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("feed_day_idx").on(t.day)],
);

/** Upcoming NFT mints the user is watching: manual WL status + last automatic check. */
export const mintWatch = pgTable("mint_watch", {
  profileId: text("profile_id").notNull(),
  slug: text("slug").notNull(),
  name: text("name"),
  chain: text("chain"),
  contract: text("contract"),
  startTime: timestamp("start_time", { withTimezone: true }),
  manualStatus: text("manual_status").notNull().default("unknown"),
  checkerUrl: text("checker_url"),
  note: text("note"),
  auto: jsonb("auto").$type<Record<string, unknown> | null>(),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.profileId, t.slug] })]);

/** Tokens received from a project (airdrop claims, rewards). Current value comes from live prices. */
export const earnings = pgTable(
  "earnings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Which farmOS profile owns the row ("default" = Iya). Always set explicitly; scoped in every query. */
    profileId: text("profile_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    /** CoinGecko id for live pricing (optional). */
    coinId: text("coin_id"),
    amount: doublePrecision("amount").notNull().default(0),
    /** Total USD value of the tokens at claim time. */
    valueAtClaim: doublePrecision("value_at_claim"),
    claimedAt: date("claimed_at").notNull(),
    wallet: text("wallet"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("earnings_profile_idx").on(t.profileId), index("earnings_project_idx").on(t.projectId)],
);

/** Per-project spend ledger: gas fees, capital/deposits and other costs, valued in USD at entry time. */
export const costs = pgTable(
  "costs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Which farmOS profile owns the row ("default" = Iya). Always set explicitly; scoped in every query. */
    profileId: text("profile_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** gas | capital | other */
    type: text("type").notNull().default("gas"),
    symbol: text("symbol").notNull(),
    /** CoinGecko id for live pricing (optional). */
    coinId: text("coin_id"),
    chain: text("chain"),
    amount: doublePrecision("amount").notNull().default(0),
    /** Total USD value when the cost was paid. */
    valueAtEntry: doublePrecision("value_at_entry"),
    spentAt: date("spent_at").notNull(),
    note: text("note"),
    /** Wallet that paid (optional; defaults to the profile's default wallet in the form). */
    wallet: text("wallet"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("costs_profile_idx").on(t.profileId), index("costs_project_idx").on(t.projectId)],
);
export type Cost = typeof costs.$inferSelect;

/** Tokens the user watches, with optional above/below price alerts (in alert_currency). */
export const watchlist = pgTable(
  "watchlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Which farmOS profile owns the row ("default" = Iya). Always set explicitly; scoped in every query. */
    profileId: text("profile_id").notNull(),
    coinId: text("coin_id").notNull(),
    symbol: text("symbol").notNull().default(""),
    name: text("name").notNull().default(""),
    image: text("image"),
    above: doublePrecision("above"),
    below: doublePrecision("below"),
    /** usd | idr | php | usdt */
    alertCurrency: text("alert_currency").notNull().default("usd"),
    /** Which alerts already fired (re-armed when the price moves back). */
    alertState: jsonb("alert_state").$type<{ above?: string | null; below?: string | null }>().notNull().default({}),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("watchlist_profile_coin_idx").on(t.profileId, t.coinId)],
);

export type Earning = typeof earnings.$inferSelect;
export type WatchItem = typeof watchlist.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type MintWatch = typeof mintWatch.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type ConnectedAccount = typeof connectedAccounts.$inferSelect;
export type FeedItem = typeof feedItems.$inferSelect;
export type Position = typeof positions.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type DiaryEntry = typeof diaryEntries.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type ChatThread = typeof chatThreads.$inferSelect;
