-- Migration 003: Add referral_code column to users
--
-- A referral_code is a deterministic, short, URL-safe slug derived from
-- the Clerk user ID. It is stored here so we can do an O(1) indexed lookup
-- when a new user arrives via a referral link, instead of scanning the
-- whole users table with a computed expression.
--
-- The derivation formula (mirrors lib/referral.ts buildReferralCode):
--   lower(regexp_replace(id, '[^a-zA-Z0-9]', '', 'g'))[1..12]
-- Example: 'user_2abc123xyz456' → 'user2abc123x'

-- 1. Add the column (nullable to handle the backfill window)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- 2. Backfill existing rows using the same formula as the TypeScript helper
UPDATE users
SET referral_code = substr(
  lower(regexp_replace(id, '[^a-zA-Z0-9]', '', 'g')),
  1,
  12
)
WHERE referral_code IS NULL;

-- 3. Unique constraint + index for fast lookups
--    We wrap in a DO block so re-running the migration is idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_referral_code_unique'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_referral_code_unique UNIQUE (referral_code);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code
  ON users (referral_code);

-- 4. Ensure all new rows written by upsertUser always include a code.
--    (The application layer sets this, but a DB default is a safety net.)
ALTER TABLE users
  ALTER COLUMN referral_code SET DEFAULT NULL;  -- application always provides it

-- 5. Existing referrals table — verify self-referral guard exists.
--    This was added in migration 001 but we re-assert it here for clarity.
--    The CHECK and UNIQUE constraints prevent:
--      a) a user referring themselves
--      b) the same referral pair being inserted twice
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'referrals_no_self_referral'
  ) THEN
    ALTER TABLE referrals
      ADD CONSTRAINT referrals_no_self_referral
        CHECK (referrer_user_id <> referred_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'referrals_unique_pair'
  ) THEN
    ALTER TABLE referrals
      ADD CONSTRAINT referrals_unique_pair
        UNIQUE (referrer_user_id, referred_user_id);
  END IF;
END
$$;
