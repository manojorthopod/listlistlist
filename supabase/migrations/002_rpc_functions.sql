-- ============================================================
-- ListListList — RPC Functions
-- Migration: 002_rpc_functions.sql
-- ============================================================
-- All credit operations are atomic transactions to prevent
-- race conditions on concurrent requests.
-- ============================================================


-- ─── deduct_credits ──────────────────────────────────────────────────────────
-- Deducts credits from a user, consuming subscription_credits first and
-- overflowing into topup_credits. Raises an exception if total credits are
-- insufficient so the caller can abort without deducting anything.
--
-- Returns: { subscription_credits, topup_credits }

CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id TEXT,
  p_amount  INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- runs as the function owner (service role), bypasses RLS
AS $$
DECLARE
  v_sub_credits   INTEGER;
  v_topup_credits INTEGER;
  v_sub_deduct    INTEGER;
  v_topup_deduct  INTEGER;
BEGIN
  -- Lock the user row to prevent concurrent over-deduction
  SELECT subscription_credits, topup_credits
  INTO   v_sub_credits, v_topup_credits
  FROM   users
  WHERE  id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;

  IF (v_sub_credits + v_topup_credits) < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits: user % has % subscription + % top-up = % total, needs %',
      p_user_id, v_sub_credits, v_topup_credits,
      (v_sub_credits + v_topup_credits), p_amount;
  END IF;

  -- Consume subscription credits first
  v_sub_deduct   := LEAST(p_amount, v_sub_credits);
  v_topup_deduct := p_amount - v_sub_deduct;

  UPDATE users
  SET
    subscription_credits = subscription_credits - v_sub_deduct,
    topup_credits        = topup_credits        - v_topup_deduct
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'subscription_credits', v_sub_credits - v_sub_deduct,
    'topup_credits',        v_topup_credits - v_topup_deduct
  );
END;
$$;


-- ─── refund_credits ───────────────────────────────────────────────────────────
-- Refunds credits after a partial generation failure. Adds back to
-- subscription_credits first (respecting rollover cap), then to topup_credits.
--
-- Returns: { subscription_credits, topup_credits }

CREATE OR REPLACE FUNCTION refund_credits(
  p_user_id     TEXT,
  p_amount      INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sub_credits   INTEGER;
  v_topup_credits INTEGER;
  v_plan          subscription_status;
  v_rollover_cap  INTEGER;
  v_sub_headroom  INTEGER;
  v_sub_refund    INTEGER;
  v_topup_refund  INTEGER;
BEGIN
  SELECT subscription_credits, topup_credits, subscription_status
  INTO   v_sub_credits, v_topup_credits, v_plan
  FROM   users
  WHERE  id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;

  -- Determine rollover cap for this plan
  v_rollover_cap := CASE v_plan
    WHEN 'trial'     THEN 10
    WHEN 'starter'   THEN 100
    WHEN 'pro'       THEN 2000
    WHEN 'cancelled' THEN 0
    ELSE 0
  END;

  -- Refund into subscription_credits up to the rollover cap, overflow to topup
  v_sub_headroom := GREATEST(0, v_rollover_cap - v_sub_credits);
  v_sub_refund   := LEAST(p_amount, v_sub_headroom);
  v_topup_refund := p_amount - v_sub_refund;

  UPDATE users
  SET
    subscription_credits = subscription_credits + v_sub_refund,
    topup_credits        = topup_credits        + v_topup_refund
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'subscription_credits', v_sub_credits + v_sub_refund,
    'topup_credits',        v_topup_credits + v_topup_refund
  );
END;
$$;


-- ─── apply_monthly_rollover ───────────────────────────────────────────────────
-- Called on invoice.paid webhook (monthly or annual renewal).
-- Adds monthly_allowance to subscription_credits, capped at rollover_cap.
-- Never touches topup_credits.
--
-- Returns: { subscription_credits }

CREATE OR REPLACE FUNCTION apply_monthly_rollover(
  p_user_id          TEXT,
  p_monthly_allowance INTEGER,
  p_rollover_cap      INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_credits INTEGER;
BEGIN
  UPDATE users
  SET subscription_credits = LEAST(subscription_credits + p_monthly_allowance, p_rollover_cap)
  WHERE id = p_user_id
  RETURNING subscription_credits INTO v_new_credits;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;

  RETURN jsonb_build_object('subscription_credits', v_new_credits);
END;
$$;


-- ─── get_demo_run_counts ──────────────────────────────────────────────────────
-- Returns the number of demo runs for a given IP hash today, and the total
-- across all IPs today. Used by /api/demo for rate limiting.

CREATE OR REPLACE FUNCTION get_demo_run_counts(
  p_ip_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ip_count    INTEGER;
  v_total_count INTEGER;
  v_today_start TIMESTAMPTZ := DATE_TRUNC('day', NOW());
BEGIN
  SELECT COUNT(*)
  INTO   v_ip_count
  FROM   demo_runs
  WHERE  ip_hash   = p_ip_hash
    AND  created_at >= v_today_start;

  SELECT COUNT(*)
  INTO   v_total_count
  FROM   demo_runs
  WHERE  created_at >= v_today_start;

  RETURN jsonb_build_object(
    'ip_count',    v_ip_count,
    'total_count', v_total_count
  );
END;
$$;


-- ─── Grant execute to authenticated role ─────────────────────────────────────
-- API routes call these via the service-role key, but granting to authenticated
-- ensures they can also be called from edge functions if needed.

GRANT EXECUTE ON FUNCTION deduct_credits(TEXT, INTEGER)              TO service_role;
GRANT EXECUTE ON FUNCTION refund_credits(TEXT, INTEGER)              TO service_role;
GRANT EXECUTE ON FUNCTION apply_monthly_rollover(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_demo_run_counts(TEXT)                  TO service_role;
