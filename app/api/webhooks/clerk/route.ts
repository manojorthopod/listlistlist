import { headers } from 'next/headers'
import { WebhookEvent, clerkClient } from '@clerk/nextjs/server'
import { Webhook } from 'svix'
import { z } from 'zod'
import { upsertUser, hasEmailBeenSent, logEmail } from '@/lib/db'
import { sendWelcomeEmail } from '@/lib/resend'
import { checkEmail, buildSignupLogEntry, type SignupLogEntry } from '@/lib/email-guard'

// ─── Webhook secret ───────────────────────────────────────────────────────────

function getWebhookSecret(): string {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) throw new Error('Missing CLERK_WEBHOOK_SECRET environment variable')
  return secret
}

// ─── Clerk user shape ─────────────────────────────────────────────────────────

// Captures the verification sub-object Clerk attaches to each email address.
// strategy examples:
//   'from_oauth_google'  — email was populated from a Google OAuth account
//   'email_code'         — user verified via a one-time code sent to their inbox
//   'email_link'         — user verified via a magic link (if enabled)
const VerificationSchema = z.object({
  status:   z.string().optional().nullable(),   // 'verified' | 'unverified' | 'failed' | 'expired'
  strategy: z.string().optional().nullable(),
}).optional().nullable()

const ClerkUserSchema = z.object({
  id: z.string(),
  email_addresses: z.array(
    z.object({
      email_address: z.string().email(),
      id:            z.string(),
      verification:  VerificationSchema,
    })
  ),
  primary_email_address_id: z.string().nullable(),
  // external_accounts is populated for OAuth signups (Google, GitHub, etc.)
  // and is an empty array for email-based signups.
  external_accounts: z.array(
    z.object({
      provider:      z.string().optional(),
      // Some Clerk versions include the OAuth account's email directly here
      email_address: z.string().email().optional().nullable(),
    })
  ).optional().default([]),
})

type ParsedClerkUser = z.infer<typeof ClerkUserSchema>

// ─── Email resolution ─────────────────────────────────────────────────────────

interface ResolvedEmail {
  email:                string
  verificationStatus:   string | null
  verificationStrategy: string | null
}

/**
 * Finds the best email to use for this user, with a preference for verified
 * addresses. Falls back gracefully for both OAuth and email+code signups.
 *
 * Resolution order:
 *   1. Primary email (by primary_email_address_id) if verified
 *   2. Primary email even if unverified (with a warning logged)
 *   3. Any verified email in the list
 *   4. First email in the list as a last resort
 *
 * In practice user.created only fires after Clerk has verified the address,
 * so the primary email should always be verified. The fallback chain guards
 * against future Clerk API changes or unusual account states.
 */
function resolveEmail(
  emailAddresses: ParsedClerkUser['email_addresses'],
  primaryId:      string | null,
): ResolvedEmail | null {
  const primary = primaryId
    ? emailAddresses.find((e) => e.id === primaryId)
    : null

  if (primary) {
    const status   = primary.verification?.status   ?? null
    const strategy = primary.verification?.strategy ?? null

    if (status === 'verified' || status === null) {
      // Verified, or no verification info present (trust Clerk)
      return { email: primary.email_address, verificationStatus: status, verificationStrategy: strategy }
    }

    // Primary email exists but is not verified — log a warning and continue
    // (we still use it; Clerk should not fire user.created with unverified emails)
    console.warn(
      `[clerk webhook] Primary email has unexpected verification status "${status}" ` +
      `(strategy: ${strategy}). Using it anyway — Clerk guarantees verification on sign-up.`
    )
    return { email: primary.email_address, verificationStatus: status, verificationStrategy: strategy }
  }

  // primary_email_address_id didn't match — fall back to first verified email
  const verified = emailAddresses.find((e) => e.verification?.status === 'verified')
  if (verified) {
    return {
      email:                verified.email_address,
      verificationStatus:   'verified',
      verificationStrategy: verified.verification?.strategy ?? null,
    }
  }

  // Last resort: first entry
  const first = emailAddresses[0]
  if (first) {
    return {
      email:                first.email_address,
      verificationStatus:   first.verification?.status   ?? null,
      verificationStrategy: first.verification?.strategy ?? null,
    }
  }

  return null
}

// ─── Provider detection ───────────────────────────────────────────────────────

/**
 * Derives a normalised provider string from Clerk's data.
 *
 * Sources (in priority order):
 *   1. external_accounts[0].provider  — set for OAuth signups
 *      Clerk prefixes OAuth providers with 'oauth_': 'oauth_google' → 'google'
 *   2. verificationStrategy           — for email-based signups:
 *      'email_code' → 'email_code', 'email_link' → 'email_link'
 *   3. Fallback: 'email'
 *
 * Having both Google OAuth AND email+code enabled is now supported.
 * Both paths must produce correct provider strings for monitoring.
 */
function resolveProvider(
  externalAccounts:     ParsedClerkUser['external_accounts'],
  verificationStrategy: string | null,
): string {
  const rawProvider = externalAccounts[0]?.provider
  if (rawProvider) {
    // Strip Clerk's 'oauth_' prefix so logs show 'google' not 'oauth_google'
    return rawProvider.replace(/^oauth_/, '')
  }

  // No external account → infer from the email's verification strategy
  if (verificationStrategy === 'email_code') return 'email_code'
  if (verificationStrategy === 'email_link') return 'email_link'

  return 'email'
}

// ─── Signup monitoring log ────────────────────────────────────────────────────

/**
 * Logs every new signup in a structured format. Runs on ALL signups — not just
 * suspicious ones — so we can monitor for patterns over time.
 *
 * In production, pipe this to a log aggregator (Datadog, Axiom, etc.).
 * Full email address is deliberately excluded to avoid PII in logs.
 */
function logSignupEvent(entry: SignupLogEntry): void {
  const tag = entry.blocked         ? '🚫 [BLOCKED]'
            : entry.isDisposable    ? '⚠️  [DISPOSABLE]'
            : entry.isSuspiciousTld ? '⚠️  [SUSPICIOUS_TLD]'
            : '✅ [SIGNUP]'

  console.log(
    `${tag} user.created`,
    JSON.stringify({
      userId:               entry.userId,
      domain:               entry.domain,
      provider:             entry.provider,
      verificationStrategy: entry.verificationStrategy,
      isDisposable:         entry.isDisposable,
      isSuspiciousTld:      entry.isSuspiciousTld,
      blocked:              entry.blocked,
      timestamp:            entry.timestamp,
    })
  )
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── 1. Verify Svix signature ─────────────────────────────────────────────
  const headerPayload = await headers()
  const svixId        = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing svix headers', { status: 400 })
  }

  const payload = await req.text()

  let event: WebhookEvent
  try {
    const wh = new Webhook(getWebhookSecret())
    event = wh.verify(payload, {
      'svix-id':        svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent
  } catch {
    return new Response('Invalid webhook signature', { status: 400 })
  }

  // ── 2. Handle user.created ───────────────────────────────────────────────
  if (event.type === 'user.created') {
    const parsed = ClerkUserSchema.safeParse(event.data)
    if (!parsed.success) {
      console.error('[clerk webhook] Failed to parse user.created payload', parsed.error)
      return new Response('Invalid payload shape', { status: 400 })
    }

    const { id, email_addresses, primary_email_address_id, external_accounts } = parsed.data

    // ── Resolve the best email address ──────────────────────────────────────
    // Works identically for Google OAuth and email+code signups:
    //   - OAuth:       email populated from external_accounts via Clerk sync
    //   - email+code:  email from the sign-up form, verified before user.created fires
    const resolved = resolveEmail(email_addresses, primary_email_address_id)

    if (!resolved) {
      console.error('[clerk webhook] No email address found for user', id)
      return new Response('No email on user', { status: 400 })
    }

    const { email: primaryEmail, verificationStrategy } = resolved

    // ── Identify signup method ───────────────────────────────────────────────
    // 'google'      — Google OAuth
    // 'email_code'  — email + one-time code
    // 'email_link'  — email + magic link
    // 'email'       — generic fallback
    const provider = resolveProvider(external_accounts, verificationStrategy)

    // ── 3. Disposable email domain check ─────────────────────────────────────
    // Applies to BOTH Google OAuth and email+code signups.
    // Note: Google OAuth + phone verification filters most abuse before it
    // reaches us; for email+code signups this check is the primary guard.
    const guard    = checkEmail(primaryEmail)
    const logEntry = buildSignupLogEntry(id, primaryEmail, provider, verificationStrategy)

    // Always log the signup event for monitoring — domain is logged, not full email
    logSignupEvent(logEntry)

    if (guard.blocked) {
      // Ban the user in Clerk so they cannot authenticate.
      // Return 200 to Clerk — Clerk does not retry 2xx responses.
      try {
        const clerk = await clerkClient()
        await clerk.users.banUser(id)
        console.warn(
          `[clerk webhook] Banned user ${id} — disposable domain: ${guard.domain} ` +
          `(provider: ${provider})`
        )
      } catch (err) {
        // Log but don't hard-fail — no Supabase row means no product access anyway
        console.error('[clerk webhook] Failed to ban disposable-domain user:', err)
      }

      // Skip Supabase upsert and welcome email — user is blocked.
      return new Response('OK', { status: 200 })
    }

    // Suspicious TLD warning — provider-aware message
    if (logEntry.isSuspiciousTld) {
      if (provider === 'google') {
        console.warn(
          `[clerk webhook] Suspicious TLD on Google OAuth signup — userId: ${id}, ` +
          `domain: ${guard.domain}. Google phone verification provides additional protection.`
        )
      } else {
        console.warn(
          `[clerk webhook] Suspicious TLD on email+code signup — userId: ${id}, ` +
          `domain: ${guard.domain}. No phone verification on this path — consider manual review.`
        )
      }
    }

    // ── 4. Upsert user row in Supabase ────────────────────────────────────────
    // Identical for all signup methods — only the email and userId matter here.
    let user
    try {
      user = await upsertUser(id, primaryEmail)
    } catch (err) {
      console.error('[clerk webhook] Failed to upsert user', err)
      return new Response('Database error', { status: 500 })
    }

    // ── 5. Send Day 0 welcome email (exactly once) ────────────────────────────
    // Identical for all signup methods.
    try {
      const alreadySent = await hasEmailBeenSent(id, 'welcome')

      // Double-guard with onboarding_email_sent flag to prevent duplicate sends
      // if the webhook is replayed by Clerk.
      if (!alreadySent && !user.onboarding_email_sent) {
        const totalCredits = user.subscription_credits + user.topup_credits
        await sendWelcomeEmail(primaryEmail, totalCredits)
        await logEmail(id, 'welcome')

        const { updateUser } = await import('@/lib/db')
        await updateUser(id, { onboarding_email_sent: true })
      }
    } catch (err) {
      // Email failure must not fail the webhook response — Clerk would retry
      // and could create a duplicate user row. Log and continue.
      console.error('[clerk webhook] Failed to send welcome email', err)
    }
  }

  // ── 6. Handle user.deleted ───────────────────────────────────────────────
  if (event.type === 'user.deleted') {
    const userId = (event.data as { id?: string }).id
    if (userId) {
      // Supabase cascade delete handles child rows (listings, email_log, etc.)
      try {
        const { db } = await import('@/lib/db')
        await db.from('users').delete().eq('id', userId)
        console.log(`[clerk webhook] Deleted user ${userId} from Supabase`)
      } catch (err) {
        console.error('[clerk webhook] Failed to delete user', err)
      }
    }
  }

  return new Response('OK', { status: 200 })
}
