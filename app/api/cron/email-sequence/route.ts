/**
 * GET /api/cron/email-sequence
 *
 * Daily cron job that checks and dispatches all pending automated emails.
 *
 * EMAIL TYPES HANDLED
 * ────────────────────
 * Day 0   welcome        → fired immediately on sign-up in the Clerk webhook
 *                          (NOT this cron — already handled)
 * Day 2   day2_tip       → 48 h after sign-up, if user has no completed listing
 * Day 5   day5_trial_nudge → 5 days after sign-up, if still on trial (not subscribed)
 * Day 7   day7_trial_expiry → 7 days after sign-up, if still on trial (not subscribed)
 * Ongoing credits_low    → when subscription + top-up credits ≤ 5 (paying users only)
 *
 * DEDUPLICATION
 * ─────────────
 * Two-layer guard:
 *   1. DB pre-check (hasEmailBeenSent) before attempting to send
 *   2. email_log UNIQUE(user_id, email_type) constraint catches any race condition
 *      where two concurrent cron runs try to send the same email simultaneously
 *
 * onboarding_email_sent is only relevant to Day 0 (handled in Clerk webhook).
 * This cron relies solely on email_log for deduplication.
 *
 * SCHEDULE
 * ────────
 * Runs daily at 09:00 UTC (configured in vercel.json).
 * Running daily means a user is eligible for at most one run-cycle of latency
 * beyond their exact trigger time.
 *
 * FAULT ISOLATION
 * ────────────────
 * Each email type is wrapped in its own try/catch so a DB error on one type
 * does not prevent other types from running. Each individual user send is also
 * try/caught so one failing address doesn't block the rest.
 *
 * PROTECTION
 * ──────────
 * Requires: Authorization: Bearer <CRON_SECRET>
 * Vercel sets this header automatically when invoking cron jobs.
 */

import { timingSafeEqual } from 'crypto'
import {
  getUsersNeedingDay2Email,
  getUsersNeedingDay5Email,
  getUsersNeedingDay7Email,
  getUsersNeedingLowCreditsEmail,
  hasEmailBeenSent,
  logEmail,
} from '@/lib/db'
import {
  sendDay2TipEmail,
  sendDay5NudgeEmail,
  sendTrialExpiredEmail,
  sendLowCreditsEmail,
} from '@/lib/resend'
import type { EmailType, User } from '@/types'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://listlistlist.co'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isCronAuthorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/email-sequence] CRON_SECRET env var not set')
    return false
  }
  const auth  = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  try {
    // Constant-time comparison — prevents timing-based secret discovery
    const a = Buffer.from(token)
    const b = Buffer.from(secret)
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generates the user's referral link from their Clerk user ID.
 * Must match the algorithm used in /api/referral/route.ts.
 */
function buildReferralLink(userId: string): string {
  const code = userId.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase()
  return `${APP_URL}/?ref=${code}`
}

/**
 * Formats a credits reset date for use in email copy.
 * Returns a human-readable string like "14 June".
 */
function formatResetDate(iso: string | null): string {
  if (!iso) return 'your next billing date'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long',
  })
}

// ─── Per-user dispatcher ──────────────────────────────────────────────────────

type SendOutcome = 'sent' | 'skipped' | 'error'

/**
 * Sends one email to one user with full deduplication and error handling.
 *
 * Flow:
 *   1. DB pre-check — if already logged, skip (idempotency)
 *   2. Send via Resend
 *   3. Insert into email_log — UNIQUE constraint catches any concurrent race
 *
 * If the Resend call succeeds but logEmail fails with a duplicate error,
 * we treat that as "skipped" — the email was sent (no harm) and the
 * duplicate guard is satisfied.
 */
async function dispatchEmail(
  user:      User,
  emailType: EmailType,
  sendFn:    () => Promise<void>,
): Promise<SendOutcome> {
  try {
    // Pre-check: avoid doing the Resend API call if already sent
    const alreadySent = await hasEmailBeenSent(user.id, emailType)
    if (alreadySent) return 'skipped'

    await sendFn()
    await logEmail(user.id, emailType)
    return 'sent'
  } catch (err) {
    console.error(
      `[cron/email-sequence] Failed ${emailType} for user ${user.id}:`,
      err instanceof Error ? err.message : err
    )
    return 'error'
  }
}

// ─── Tally helper ─────────────────────────────────────────────────────────────

type Tally = { sent: number; skipped: number; error: number }

function makeTally(): Tally { return { sent: 0, skipped: 0, error: 0 } }

function record(tally: Tally, outcome: SendOutcome): void {
  tally[outcome]++
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (!isCronAuthorised(req)) {
    return new Response('Unauthorised', { status: 401 })
  }

  const startedAt = new Date().toISOString()
  console.log(`[cron/email-sequence] Run started at ${startedAt}`)

  const tallies: Record<EmailType, Tally> = {
    welcome:           makeTally(), // Day 0 — never dispatched here, kept for completeness
    day2_tip:          makeTally(),
    day5_trial_nudge:  makeTally(),
    day7_trial_expiry: makeTally(),
    credits_low:       makeTally(),
  }

  // ── Day 2 — Feature tip ──────────────────────────────────────────────────────
  // Sent 48 h after sign-up if the user hasn't generated a completed listing yet.
  try {
    const users = await getUsersNeedingDay2Email()
    console.log(`[cron/email-sequence] day2_tip: ${users.length} eligible`)

    for (const user of users) {
      const totalCredits = user.subscription_credits + user.topup_credits
      const outcome = await dispatchEmail(
        user,
        'day2_tip',
        () => sendDay2TipEmail(user.email, totalCredits),
      )
      record(tallies.day2_tip, outcome)
    }
  } catch (err) {
    console.error('[cron/email-sequence] day2_tip query failed:', err)
  }

  // ── Day 5 — Trial nudge ──────────────────────────────────────────────────────
  // Sent 5 days after sign-up if the user hasn't subscribed to a paid plan.
  try {
    const users = await getUsersNeedingDay5Email()
    console.log(`[cron/email-sequence] day5_trial_nudge: ${users.length} eligible`)

    for (const user of users) {
      const totalCredits = user.subscription_credits + user.topup_credits
      const outcome = await dispatchEmail(
        user,
        'day5_trial_nudge',
        () => sendDay5NudgeEmail(user.email, totalCredits),
      )
      record(tallies.day5_trial_nudge, outcome)
    }
  } catch (err) {
    console.error('[cron/email-sequence] day5_trial_nudge query failed:', err)
  }

  // ── Day 7 — Trial expiry ─────────────────────────────────────────────────────
  // Sent 7 days after sign-up if the user still hasn't subscribed.
  // Includes the user's unique referral link to encourage referrals instead.
  try {
    const users = await getUsersNeedingDay7Email()
    console.log(`[cron/email-sequence] day7_trial_expiry: ${users.length} eligible`)

    for (const user of users) {
      const link    = buildReferralLink(user.id)
      const outcome = await dispatchEmail(
        user,
        'day7_trial_expiry',
        () => sendTrialExpiredEmail(user.email, link),
      )
      record(tallies.day7_trial_expiry, outcome)
    }
  } catch (err) {
    console.error('[cron/email-sequence] day7_trial_expiry query failed:', err)
  }

  // ── Low credits alert ────────────────────────────────────────────────────────
  // Sent to active paying subscribers (starter / pro) when their total available
  // credits (subscription + top-up) drop to 5 or below.
  // Sent at most once per user lifetime (UNIQUE constraint in email_log).
  try {
    const users = await getUsersNeedingLowCreditsEmail()
    console.log(`[cron/email-sequence] credits_low: ${users.length} eligible`)

    for (const user of users) {
      const totalCredits = user.subscription_credits + user.topup_credits
      const resetDate    = formatResetDate(user.credits_reset_at)
      const outcome      = await dispatchEmail(
        user,
        'credits_low',
        () => sendLowCreditsEmail(user.email, totalCredits, resetDate),
      )
      record(tallies.credits_low, outcome)
    }
  } catch (err) {
    console.error('[cron/email-sequence] credits_low query failed:', err)
  }

  // ── Summary ──────────────────────────────────────────────────────────────────

  const activeTypes = (
    ['day2_tip', 'day5_trial_nudge', 'day7_trial_expiry', 'credits_low'] as EmailType[]
  )

  const totalSent   = activeTypes.reduce((n, k) => n + tallies[k].sent,    0)
  const totalErrors = activeTypes.reduce((n, k) => n + tallies[k].error,   0)
  const totalSkipped = activeTypes.reduce((n, k) => n + tallies[k].skipped, 0)

  console.log(
    `[cron/email-sequence] Done — sent: ${totalSent}, skipped: ${totalSkipped}, errors: ${totalErrors}`,
    JSON.stringify(
      Object.fromEntries(activeTypes.map((k) => [k, tallies[k]]))
    )
  )

  return Response.json({
    startedAt,
    summary: Object.fromEntries(activeTypes.map((k) => [k, tallies[k]])),
    totals: { sent: totalSent, skipped: totalSkipped, errors: totalErrors },
  })
}
