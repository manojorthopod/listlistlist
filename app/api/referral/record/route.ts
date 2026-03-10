/**
 * POST /api/referral/record
 *
 * Called client-side by ReferralRecorder after the user signs up.
 * Reads the referral code that was stored in localStorage (set by the
 * sign-up page from the ?ref= URL param) and creates the referral row.
 *
 * Guards:
 *   1. Auth required — only the newly-signed-up user can record their own referral
 *   2. Code validation — must match [a-z0-9]{1,20}
 *   3. Referrer lookup — returns 404 if no user has that code
 *   4. Self-referral guard — enforced at DB level (CHECK constraint) and here
 *   5. Idempotency — the UNIQUE(referrer_user_id, referred_user_id) constraint
 *      means duplicate calls are silently ignored (we return 200 both times)
 *   6. Already-subscribed check — if the referred user already has an active
 *      plan (rare edge case: subscribed before visiting the dashboard), we
 *      award credits immediately rather than waiting for the Stripe webhook
 */

import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import {
  getUserByReferralCode,
  getUserById,
  createReferral,
  awardReferralIfNotAwarded,
} from '@/lib/db'
import { isValidReferralCode } from '@/lib/referral'

const BodySchema = z.object({
  referralCode: z.string().min(1).max(20),
})

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // ── Parse & validate body ────────────────────────────────────────────────
  let body: z.infer<typeof BodySchema>
  try {
    const raw = await req.json()
    body = BodySchema.parse(raw)
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const code = body.referralCode.toLowerCase()

  if (!isValidReferralCode(code)) {
    return Response.json({ error: 'Invalid referral code format' }, { status: 400 })
  }

  // ── Self-referral guard ───────────────────────────────────────────────────
  // Check in application code before hitting the DB constraint, so we can
  // return a clean response rather than a constraint violation error.
  const referrer = await getUserByReferralCode(code)

  if (!referrer) {
    // Unknown code — could be a stale link or typo. Return 200 rather than
    // 404 to avoid leaking whether a code exists.
    return Response.json({ recorded: false, reason: 'unknown_code' })
  }

  if (referrer.id === userId) {
    return Response.json({ recorded: false, reason: 'self_referral' })
  }

  // ── Create the referral row ───────────────────────────────────────────────
  // createReferral inserts into the referrals table. If the pair already
  // exists (UNIQUE constraint), Supabase throws — we catch and treat as ok.
  let referralId: string | null = null
  try {
    const referral = await createReferral(referrer.id, userId)
    referralId = referral.id
    console.log(`[referral/record] Created referral ${referral.id}: ${referrer.id} → ${userId}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('referrals_unique_pair')) {
      // Already recorded — idempotent success
      return Response.json({ recorded: false, reason: 'already_recorded' })
    }
    console.error('[referral/record] Failed to create referral:', err)
    return Response.json({ error: 'Database error' }, { status: 500 })
  }

  // ── Edge case: referred user already subscribed ───────────────────────────
  // Normally the Stripe webhook awards credits when the user subscribes.
  // But if they navigated directly to /pricing and subscribed before ever
  // visiting the dashboard (and therefore before ReferralRecorder ran), we
  // need to award credits here instead.
  try {
    const referredUser = await getUserById(userId)
    const alreadySubscribed =
      referredUser?.subscription_status === 'starter' ||
      referredUser?.subscription_status === 'pro'

    if (alreadySubscribed && referralId) {
      const awarded = await awardReferralIfNotAwarded(referralId, referrer.id)
      if (awarded) {
        console.log(
          `[referral/record] Awarded credits immediately — referred user already subscribed. ` +
          `Referrer: ${referrer.id}, Referred: ${userId}`
        )
      }
    }
  } catch (err) {
    // Credit award failure must not fail the response — the Stripe webhook
    // will attempt to award when the subscription event fires.
    console.error('[referral/record] Error checking subscription for immediate award:', err)
  }

  return Response.json({ recorded: true })
}
