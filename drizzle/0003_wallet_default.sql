-- farmOS: one default wallet per profile. Additive only, idempotent.
ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT false NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "wallets_profile_default_idx" ON "wallets" ("profile_id") WHERE "is_default";
-- Optional wallet on gas / capital entries (preselected from the default wallet).
ALTER TABLE "costs" ADD COLUMN IF NOT EXISTS "wallet" text;
