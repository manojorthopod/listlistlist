import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { Webhook } from 'svix'
import { z } from 'zod'
import { upsertUser, hasEmailBeenSent, logEmail } from '@/lib/db'
import { sendWelcomeEmail } from '@/lib/resend'

// Svix verifies the webhook payload is genuinely from Clerk
function getWebhookSecret(): string {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) throw new Error('Missing CLERK_WEBHOOK_SECRET environment variable')
  return secret
}

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
})

export async function POST(req: Request) {
  // ── 1. Verify signature ──────────────────────────────────────────────────
  const headerPayload = headers()
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

    const { id, email_addresses, primary_email_address_id } = parsed.data

    // Resolve primary email
    const primaryEmail =
      email_addresses.find((e) => e.id === primary_email_address_id)?.email_address ??
      email_addresses[0]?.email_address

    if (!primaryEmail) {
      console.error('[clerk webhook] No email found for user', id)
      return new Response('No email on user', { status: 400 })
    }

    // ── 3. Upsert user row in Supabase ─────────────────────────────────────
    let user
    try {
      user = await upsertUser(id, primaryEmail)
    } catch (err) {
      console.error('[clerk webhook] Failed to upsert user', err)
      return new Response('Database error', { status: 500 })
    }

    // ── 4. Send Day 0 welcome email (exactly once) ─────────────────────────
    try {
      const alreadySent = await hasEmailBeenSent(id, 'welcome')

      // Also guard with the onboarding_email_sent flag on the users row
      if (!alreadySent && !user.onboarding_email_sent) {
        const totalCredits = user.subscription_credits + user.topup_credits
        await sendWelcomeEmail(primaryEmail, totalCredits)
        await logEmail(id, 'welcome')

        // Mark the flag on the user row so other code paths can check it cheaply
        const { updateUser } = await import('@/lib/db')
        await updateUser(id, { onboarding_email_sent: true })
      }
    } catch (err) {
      // Email failure must not fail the webhook response — Clerk would retry
      // and create a duplicate user row. Log and continue.
      console.error('[clerk webhook] Failed to send welcome email', err)
    }
  }

  // ── 5. Handle user.deleted ───────────────────────────────────────────────
  if (event.type === 'user.deleted') {
    const userId = (event.data as { id?: string }).id
    if (userId) {
      // Supabase cascade delete handles child rows (listings, email_log, etc.)
      try {
        const { db } = await import('@/lib/db')
        await db.from('users').delete().eq('id', userId)
      } catch (err) {
        console.error('[clerk webhook] Failed to delete user', err)
      }
    }
  }

  return new Response('OK', { status: 200 })
}
