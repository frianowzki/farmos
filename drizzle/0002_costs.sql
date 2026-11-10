-- farmOS: per-project gas fee / capital ledger. Additive only, idempotent.
CREATE TABLE IF NOT EXISTS "costs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" text NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "type" text DEFAULT 'gas' NOT NULL,
  "symbol" text NOT NULL,
  "coin_id" text,
  "chain" text,
  "amount" double precision DEFAULT 0 NOT NULL,
  "value_at_entry" double precision,
  "spent_at" date NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "costs_profile_idx" ON "costs" ("profile_id");
CREATE INDEX IF NOT EXISTS "costs_project_idx" ON "costs" ("project_id");
