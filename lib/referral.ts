/**
 * lib/referral.ts
 *
 * Shared referral utilities used by:
 *   - /api/referral          (GET — referral stats for the widget)
 *   - /api/referral/record   (POST — create the referral row after sign-up)
 *   - /api/webhooks/stripe   (award credits on first subscription)
 *   - app/api/cron/email-sequence (Day 7 email referral link)
 *
 * The referral code is a deterministic, lowercase alphanumeric slug derived
 * from the Clerk user ID. It is stored in users.referral_code (migration 003)
 * so lookups are O(1) via a unique index rather than a full-table scan.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://listlistlist.co'

// Validation regex — only accept referral codes that match this pattern.
// Codes are always 12 lowercase alphanumeric characters (see buildReferralCode).
export const REFERRAL_CODE_REGEX = /^[a-z0-9]{1,20}$/

/**
 * Derive the referral code from a Clerk user ID.
 *
 * Algorithm (must stay in sync with the SQL backfill in migration 003):
 *   1. Remove all non-alphanumeric characters
 *   2. Lowercase
 *   3. Take the first 12 characters
 *
 * Example: 'user_2abc123xyz456' → 'user2abc123x'
 */
export function buildReferralCode(userId: string): string {
  return userId.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase()
}

/** Full referral link for sharing, e.g. https://listlistlist.co/?ref=user2abc123x */
export function buildReferralLink(userId: string): string {
  return `${APP_URL}/?ref=${buildReferralCode(userId)}`
}

/** Validate that a candidate code looks plausible before hitting the DB. */
export function isValidReferralCode(code: unknown): code is string {
  return typeof code === 'string' && REFERRAL_CODE_REGEX.test(code)
}
