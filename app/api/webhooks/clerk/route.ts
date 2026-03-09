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

// Minimal shape we need from Clerk's user.created event
const ClerkUserSchema = z.object({
  id: z.string(),
  email_addresses: z.array(
    z.object({
      email_address: z.string().email(),
      id:            z.string(),
    })
  ),
  primary_email_address_id: z.string().nullable(),
  // external_accounts lets us identify the OAuth provider
  external_accounts: z.array(
    z.object({
      provider: z.string().optional(),
    })
  ).optional().default([]),
})

// ─── Signup monitoring log ────────────────────────────────────────────────────

/**
 * Logs every new signup in a structured format. This runs on ALL signups —
 * not just suspicious ones — so we can monitor for patterns over time.
 *
 * In production, pipe this to a log aggregator (Datadog, Axiom, etc.).
 * For now, structured console output is sufficient.
 */
function logSignupEvent(entry: SignupLogEntry): void {
  const tag    = entry.blocked        ? '🚫 [BLOCKED]'
               : entry.isDisposable   ? '⚠️  [DISPOSABLE]'    // shouldn't reach here if blocked correctly
               : entry.isSuspiciousTld ? '⚠️  [SUSPICIOUS_TLD]'
               : '✅ [SIGNUP]'

  console.log(
    `${tag} user.created`,
    JSON.stringify({
      userId:          entry.userId,
      domain:          entry.domain,
      provider:        entry.provider,
      isDisposable:    entry.isDisposable,
      isSuspiciousTld: entry.isSuspiciousTld,
      blocked:         entry.blocked,
      timestamp:       entry.timestamp,
      // Never log the full email address in production logs to avoid PII leakage
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

    // Resolve primary email
    const primaryEmail =
      email_addresses.find((e) => e.id === primary_email_address_id)?.email_address ??
      email_addresses[0]?.email_address

    if (!primaryEmail) {
      console.error('[clerk webhook] No email found for user', id)
      return new Response('No email on user', { status: 400 })
    }

    // Identify the OAuth provider for logging
    // Google OAuth is the exclusive sign-in method; email/password is disabled.
    // Google requires phone verification, which filters most automated abuse
    // before it ever reaches this webhook.
    const provider = external_accounts[0]?.provider ?? 'email'

    // ── 3. Disposable email domain check ─────────────────────────────────────
    const guard    = checkEmail(primaryEmail)
    const logEntry = buildSignupLogEntry(id, primaryEmail, provider)

    // Always log the signup event for monitoring — domain is logged, not full email
    logSignupEvent(logEntry)

    if (guard.blocked) {
      // Ban the user in Clerk so they cannot authenticate.
      // Return 200 to Clerk (not an error on our end — we processed the event
      // correctly); Clerk does not retry 2xx responses.
      try {
        const clerk = await clerkClient()
        await clerk.users.banUser(id)
        console.warn(
          `[clerk webhook] Banned user ${id} — disposable domain: ${guard.domain}`
        )
      } catch (err) {
        // Log but don't hard-fail — the user has no Supabase row and no credits,
        // so they can't actually use the product even if the ban API call fails.
        console.error('[clerk webhook] Failed to ban disposable-domain user:', err)
      }

      // Skip Supabase upsert and welcome email — this user is blocked.
      // Return 200 so Clerk does not retry.
      return new Response('OK', { status: 200 })
    }

    // Log suspicious TLD as a warning — we allow it through but flag for review
    if (logEntry.isSuspiciousTld) {
      console.warn(
        `[clerk webhook] Suspicious TLD on signup — userId: ${id}, domain: ${guard.domain}. ` +
        `Allowed (Google OAuth phone-verification provides sufficient protection).`
      )
    }

    // ── 4. Upsert user row in Supabase ────────────────────────────────────────
    let user
    try {
      user = await upsertUser(id, primaryEmail)
    } catch (err) {
      console.error('[clerk webhook] Failed to upsert user', err)
      return new Response('Database error', { status: 500 })
    }

    // ── 5. Send Day 0 welcome email (exactly once) ────────────────────────────
    try {
      const alreadySent = await hasEmailBeenSent(id, 'welcome')

      // Double-guard with onboarding_email_sent flag on the user row to
      // prevent duplicate sends if the webhook is replayed by Clerk.
      if (!alreadySent && !user.onboarding_email_sent) {
        const totalCredits = user.subscription_credits + user.topup_credits
        await sendWelcomeEmail(primaryEmail, totalCredits)
        await logEmail(id, 'welcome')

        // Mark the flag so other code paths can check it cheaply
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
