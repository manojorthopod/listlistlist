/**
 * GET /api/cron/credit-rollover
 *
 * Monthly credit rollover for annual subscribers.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Stripe's invoice.paid webhook fires once per YEAR for annual subscriptions.
 * Annual subscribers should still receive their monthly credit allowance every
 * calendar month (same as monthly subscribers). The invoice.paid webhook handles
 * month 1 of each annual billing period and sets credits_reset_at to 1 month
 * from the invoice date. This cron job handles months 2–12 by processing all
 * annual subscribers whose credits_reset_at has passed.
 *
 * It also acts as a safety net for monthly subscribers in case the invoice.paid
 * webhook was missed (Stripe delivery failure), though this is rare.
 *
 * SCHEDULE
 * ────────
 * Runs daily at 08:00 UTC (defined in vercel.json). Running daily rather than
 * monthly ensures any overdue resets are caught within 24 hours.
 *
 * PROTECTION
 * ──────────
 * Requires Authorization: Bearer <CRON_SECRET> header.
 * Vercel's built-in cron invocations include this header automatically when
 * CRON_SECRET is set. External calls (for testing) must supply it manually.
 *
 * IDEMPOTENCY
 * ───────────
 * Each user is only processed if credits_reset_at <= NOW(). After processing,
 * credits_reset_at is advanced by 1 month. Re-running the cron on the same day
 * will skip all already-processed users.
 */

import { db, applyMonthlyRollover, updateUser } from '@/lib/db'
import { PLAN_CREDITS, PLAN_ROLLOVER_CAP } from '@/lib/stripe'

// ─── Auth helper ──────────────────────────────────────────────────────────────

function getCronSecret(): string {
  const secret = process.env.CRON_SECRET
  if (!secret) throw new Error('Missing CRON_SECRET environment variable')
  return secret
}

function isCronAuthorised(req: Request): boolean {
  const auth   = req.headers.get('authorization') ?? ''
  const token  = auth.replace(/^Bearer\s+/i, '')
  try {
    return token === getCronSecret()
  } catch {
    return false
  }
}

// ─── Date helper ──────────────────────────────────────────────────────────────

/**
 * Advances a date by exactly one calendar month.
 * Clamps to last day of month when necessary (e.g. Jan 31 → Feb 28).
 */
function addOneMonth(date: Date): Date {
  const result = new Date(date)
  const day    = result.getDate()
  result.setMonth(result.getMonth() + 1)
  if (result.getDate() !== day) result.setDate(0)
  return result
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcessedUser {
  userId:     string
  plan:       'starter' | 'pro'
  interval:   string
  oldReset:   string
  newReset:   string
  newBalance: number
}

interface SkippedUser {
  userId: string
  reason: string
}

// ─── Route handler ────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // ── Authentication ─────────────────────────────────────────────────────────
  if (!isCronAuthorised(req)) {
    console.error('[cron/credit-rollover] Unauthorised request')
    return new Response('Unauthorised', { status: 401 })
  }

  const now    = new Date()
  const nowIso = now.toISOString()

  console.log(`[cron/credit-rollover] Starting run at ${nowIso}`)

  // ── Find eligible users ────────────────────────────────────────────────────
  // Fetch all active paying users whose credits_reset_at has passed.
  // We process both 'annual' and 'monthly' subscribers here — monthly subscribers
  // are normally handled by the invoice.paid webhook, but this cron acts as a
  // safety net. Duplicate processing is prevented by the credits_reset_at guard.
  const { data: eligibleUsers, error: fetchError } = await db
    .from('users')
    .select('id, subscription_status, billing_interval, credits_reset_at')
    .in('subscription_status', ['starter', 'pro'])
    .lte('credits_reset_at', nowIso)   // credits_reset_at <= NOW()
    .not('credits_reset_at', 'is', null)

  if (fetchError) {
    console.error('[cron/credit-rollover] Failed to fetch eligible users:', fetchError.message)
    return Response.json(
      { error: 'Database error fetching users', detail: fetchError.message },
      { status: 500 }
    )
  }

  if (!eligibleUsers || eligibleUsers.length === 0) {
    console.log('[cron/credit-rollover] No users due for rollover')
    return Response.json({ processed: 0, skipped: 0, users: [] })
  }

  console.log(`[cron/credit-rollover] ${eligibleUsers.length} user(s) due for rollover`)

  const processed: ProcessedUser[] = []
  const skipped:   SkippedUser[]   = []

  for (const user of eligibleUsers) {
    const plan     = user.subscription_status as 'starter' | 'pro'
    const interval = user.billing_interval    as string
    const oldReset = user.credits_reset_at    as string

    try {
      // Apply rollover: subscription_credits = MIN(current + allowance, cap)
      const result = await applyMonthlyRollover(
        user.id,
        PLAN_CREDITS[plan],
        PLAN_ROLLOVER_CAP[plan]
      )

      // Advance credits_reset_at by exactly 1 calendar month
      const nextReset = addOneMonth(new Date(oldReset)).toISOString()
      await updateUser(user.id, { credits_reset_at: nextReset })

      processed.push({
        userId:     user.id,
        plan,
        interval,
        oldReset,
        newReset:   nextReset,
        newBalance: result.subscription_credits,
      })

      console.log(
        `[cron/credit-rollover] Processed user ${user.id} (${plan}, ${interval}) — ` +
        `+${PLAN_CREDITS[plan]} credits, new balance: ${result.subscription_credits}, ` +
        `next reset: ${nextReset}`
      )
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      skipped.push({ userId: user.id, reason })
      console.error(`[cron/credit-rollover] Failed to process user ${user.id}:`, reason)
      // Continue processing remaining users — don't let one failure abort the run
    }
  }

  console.log(
    `[cron/credit-rollover] Done — processed: ${processed.length}, failed: ${skipped.length}`
  )

  return Response.json({
    processed: processed.length,
    skipped:   skipped.length,
    // Include summary but not full user IDs in case response is logged externally
    planBreakdown: processed.reduce<Record<string, number>>((acc, u) => {
      const key = `${u.plan}_${u.interval}`
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {}),
    errors: skipped.map((s) => ({ userId: s.userId, reason: s.reason })),
  })
}
