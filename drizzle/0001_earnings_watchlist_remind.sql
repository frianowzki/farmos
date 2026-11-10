-- farmOS: earnings + watchlist tables, per-task digest reminder flag. Additive only, idempotent.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "remind" boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS "earnings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" text NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "symbol" text NOT NULL,
  "coin_id" text,
  "amount" double precision DEFAULT 0 NOT NULL,
  "value_at_claim" double precision,
  "claimed_at" date NOT NULL,
  "wallet" text,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "earnings_profile_idx" ON "earnings" ("profile_id");
CREATE INDEX IF NOT EXISTS "earnings_project_idx" ON "earnings" ("project_id");
CREATE TABLE IF NOT EXISTS "watchlist" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" text NOT NULL,
  "coin_id" text NOT NULL,
  "symbol" text DEFAULT '' NOT NULL,
  "name" text DEFAULT '' NOT NULL,
  "image" text,
  "above" double precision,
  "below" double precision,
  "alert_currency" text DEFAULT 'usd' NOT NULL,
  "alert_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "watchlist_profile_coin_idx" ON "watchlist" ("profile_id", "coin_id");
