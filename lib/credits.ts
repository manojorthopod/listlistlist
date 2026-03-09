/**
 * lib/credits.ts
 *
 * All credit logic lives here. Never write ad-hoc credit deduction inline.
 * Every operation goes through these helpers, which delegate to the
 * atomic Supabase RPC functions for safety on concurrent requests.
 */

import { deductCredits, refundCredits, getUserById } from '@/lib/db'
import type { SubscriptionStatus } from '@/types'

export const ROLLOVER_CAP: Record<SubscriptionStatus, number> = {
  trial:     10,
  starter:   100,
  pro:       2000,
  cancelled: 0,
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Returns total available credits for a user (subscription + topup).
 * Throws if the user row is not found.
 */
export async function getTotalCredits(userId: string): Promise<number> {
  const user = await getUserById(userId)
  if (!user) throw new Error(`User ${userId} not found`)
  return user.subscription_credits + user.topup_credits
}

/**
 * Validates the user has enough credits for the requested operation.
 * Returns the user object (avoids a second DB call in the caller).
 * Throws a descriptive error if insufficient.
 */
export async function assertSufficientCredits(
  userId:   string,
  required: number
): Promise<{ subscriptionCredits: number; topupCredits: number }> {
  const user = await getUserById(userId)
  if (!user) throw new Error(`User ${userId} not found`)

  const total = user.subscription_credits + user.topup_credits
  if (total < required) {
    throw new Error(
      `Insufficient credits: ${total} available, ${required} required`
    )
  }

  return {
    subscriptionCredits: user.subscription_credits,
    topupCredits:        user.topup_credits,
  }
}

/**
 * Atomically deducts `amount` credits via Supabase RPC.
 * Subscription credits are consumed first; overflow goes to topup credits.
 * Throws if the RPC fails (race condition caught server-side).
 */
export async function spendCredits(
  userId: string,
  amount: number
): Promise<{ subscriptionCredits: number; topupCredits: number }> {
  const result = await deductCredits(userId, amount)
  return {
    subscriptionCredits: result.subscription_credits,
    topupCredits:        result.topup_credits,
  }
}

/**
 * Refunds `amount` credits after a partial generation failure.
 * Adds back to subscription credits up to the rollover cap,
 * then to topup credits.
 */
export async function refundFailedCredits(
  userId: string,
  amount: number
): Promise<void> {
  await refundCredits(userId, amount)
}
