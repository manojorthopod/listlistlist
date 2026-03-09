-- ============================================================
-- ListListList — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trial', 'starter', 'pro', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE billing_interval AS ENUM ('monthly', 'annual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE listing_status AS ENUM ('pending', 'confirming', 'generating', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE email_type AS ENUM (
    'welcome',
    'day2_tip',
    'day5_trial_nudge',
    'day7_trial_expiry',
    'credits_low'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── users ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id                     TEXT        PRIMARY KEY,          -- Clerk user ID
  email                  TEXT        NOT NULL UNIQUE,
  stripe_customer_id     TEXT,
  subscription_status    subscription_status NOT NULL DEFAULT 'trial',
  billing_interval       billing_interval    NOT NULL DEFAULT 'monthly',
  subscription_credits   INTEGER     NOT NULL DEFAULT 10,  -- 10 trial credits
  topup_credits          INTEGER     NOT NULL DEFAULT 0,
  preferred_platforms    TEXT[]      NOT NULL DEFAULT '{}',
  brand_voice            TEXT,
  trial_started_at       TIMESTAMPTZ DEFAULT NOW(),
  credits_reset_at       TIMESTAMPTZ,
  onboarding_email_sent  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT subscription_credits_non_negative CHECK (subscription_credits >= 0),
  CONSTRAINT topup_credits_non_negative         CHECK (topup_credits >= 0)
);

-- ─── listings ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS listings (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url          TEXT        NOT NULL,
  image_hash         TEXT        NOT NULL,              -- SHA-256 for deduplication
  extracted_data     JSONB,                             -- user-confirmed product data
  platforms          TEXT[]      NOT NULL DEFAULT '{}',
  generated_listings JSONB,                             -- keyed by platform name
  prompt_version     TEXT        NOT NULL DEFAULT 'v1.0',
  status             listing_status NOT NULL DEFAULT 'pending',
  credits_used       INTEGER     NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_user_id    ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_image_hash ON listings(image_hash);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC);

-- ─── topup_purchases ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS topup_purchases (
  id                       UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  TEXT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT  NOT NULL UNIQUE,
  pack_name                TEXT  NOT NULL,   -- 'starter_pack' | 'growth_pack' | 'scale_pack'
  credits_purchased        INTEGER NOT NULL,
  amount_paid              INTEGER NOT NULL, -- in pence
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topup_purchases_user_id ON topup_purchases(user_id);

-- ─── referrals ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS referrals (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credits_awarded  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT referrals_no_self_referral CHECK (referrer_user_id <> referred_user_id),
  CONSTRAINT referrals_unique_pair      UNIQUE (referrer_user_id, referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);

-- ─── email_log ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_log (
  id         UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_type email_type NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate sends of the same email type to the same user
  CONSTRAINT email_log_unique_send UNIQUE (user_id, email_type)
);

CREATE INDEX IF NOT EXISTS idx_email_log_user_id ON email_log(user_id);

-- ─── demo_runs ───────────────────────────────────────────────────────────────
-- Tracks demo usage for rate limiting (no auth required on /api/demo)

CREATE TABLE IF NOT EXISTS demo_runs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash    TEXT        NOT NULL,   -- hashed IP, never store raw IPs
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_runs_ip_hash    ON demo_runs(ip_hash);
CREATE INDEX IF NOT EXISTS idx_demo_runs_created_at ON demo_runs(created_at DESC);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- All mutations happen via service-role key from API routes.
-- RLS policies below allow authenticated users to read their own data only.

ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE topup_purchases  ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_runs        ENABLE ROW LEVEL SECURITY;

-- Policies use DO blocks so re-running is safe (CREATE POLICY has no IF NOT EXISTS)

DO $$ BEGIN
  CREATE POLICY "users_select_own" ON users
    FOR SELECT USING (id = current_setting('app.current_user_id', TRUE));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "listings_select_own" ON listings
    FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "topup_purchases_select_own" ON topup_purchases
    FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "referrals_select_own" ON referrals
    FOR SELECT USING (referrer_user_id = current_setting('app.current_user_id', TRUE));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- email_log and demo_runs: no direct client access — service role only
-- (no SELECT policy = blocked for anon/authenticated roles)
