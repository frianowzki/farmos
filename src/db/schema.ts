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
};

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("projects_category_idx").on(t.category), index("projects_status_idx").on(t.status)],
);

export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
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
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  cadence: text("cadence").notNull().default("daily"),
  intervalDays: integer("interval_days").notNull().default(1),
  weekdays: integer("weekdays").array().notNull().default([]),
  startDate: date("start_date").notNull(),
  url: text("url"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const taskCompletions = pgTable(
  "task_completions",
  {
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
    address: text("address").notNull(),
    label: text("label").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("wallets_address_idx").on(t.address)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatThreads = pgTable("chat_threads", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default("New chat"),
  mode: text("mode").notNull().default("chat"),
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const googleTokens = pgTable("google_tokens", {
  id: text("id").primaryKey(),
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

export type Project = typeof projects.$inferSelect;
export type Position = typeof positions.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type DiaryEntry = typeof diaryEntries.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type ChatThread = typeof chatThreads.$inferSelect;
