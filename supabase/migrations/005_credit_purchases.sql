-- Unified purchase ledger for account billing history.
-- Includes both subscription checkouts and one-time top-up payments.

CREATE TABLE IF NOT EXISTS credit_purchases (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount                   INTEGER NOT NULL, -- in pence
  credits                  INTEGER NOT NULL,
  type                     TEXT NOT NULL CHECK (type IN ('subscription', 'topup')),
  stripe_payment_intent_id TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_user_id
  ON credit_purchases(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_created_at
  ON credit_purchases(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_purchases_pi_unique
  ON credit_purchases(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- Backfill existing top-up history so account page can show past purchases.
INSERT INTO credit_purchases (
  user_id,
  amount,
  credits,
  type,
  stripe_payment_intent_id,
  created_at
)
SELECT
  tp.user_id,
  tp.amount_paid,
  tp.credits_purchased,
  'topup',
  tp.stripe_payment_intent_id,
  tp.created_at
FROM topup_purchases tp
WHERE NOT EXISTS (
  SELECT 1
  FROM credit_purchases cp
  WHERE cp.stripe_payment_intent_id = tp.stripe_payment_intent_id
);

ALTER TABLE credit_purchases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "credit_purchases_select_own" ON credit_purchases
    FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
