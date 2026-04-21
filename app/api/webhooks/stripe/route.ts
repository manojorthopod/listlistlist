import { headers } from 'next/headers'
import Stripe from 'stripe'
import {
  stripe,
  planFromPriceId,
  intervalFromPriceId,
  PLAN_CREDITS,
  PLAN_ROLLOVER_CAP,
  TOPUP_CREDITS,
} from '@/lib/stripe'
import {
  db,
  updateUser,
  createTopupPurchase,
  createCreditPurchase,
  applyMonthlyRollover,
  getReferralForReferredUser,
  awardReferralIfNotAwarded,
} from '@/lib/db'
import type { TopupPackId } from '@/types'

// Stripe requires the raw body for signature verification — no JSON parsing
export const dynamic = 'force-dynamic'

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new Error('Missing STRIPE_WEBHOOK_SECRET environment variable')
  return secret
}

/** In this Stripe SDK version, current_period_end moved to SubscriptionItem */
function getPeriodEnd(subscription: Stripe.Subscription): number | null {
  return subscription.items.data[0]?.current_period_end ?? null
}

/**
 * Advances a date by exactly one calendar month.
 * Handles end-of-month edge cases: e.g. Jan 31 → Feb 28 (not March 2/3).
 */
function addOneMonth(date: Date): Date {
  const result = new Date(date)
  const day    = result.getDate()
  result.setMonth(result.getMonth() + 1)
  // If the day overflowed (e.g. Jan 31 → Mar 3), clamp to last day of target month
  if (result.getDate() !== day) {
    result.setDate(0) // day 0 = last day of the previous month
  }
  return result
}

/** Invoice.subscription moved to invoice.parent.subscription_details.subscription */
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent as (Stripe.Invoice.Parent & {
    type: string
    subscription_details?: { subscription?: string | Stripe.Subscription }
  }) | null

  if (!parent || parent.type !== 'subscription_details') return null
  const sub = parent.subscription_details?.subscription
  if (!sub) return null
  return typeof sub === 'string' ? sub : sub.id
}

export async function POST(req: Request) {
  const body      = await req.text()
  const signature = (await headers()).get('stripe-signature')

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, getWebhookSecret())
  } catch (err) {
    console.error('[stripe webhook] Signature verification failed:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  console.log(`[stripe webhook] Received event: ${event.type}`)

  try {
    switch (event.type) {

      // ── checkout.session.completed ──────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        const userId = session.metadata?.userId ?? session.client_reference_id
        if (!userId) {
          console.error('[stripe webhook] No userId on checkout.session.completed')
          break
        }

        // Always persist the Stripe customer ID
        if (session.customer) {
          await updateUser(userId, {
            stripe_customer_id: session.customer as string,
          })
        }

        // ── mode: subscription (new subscriber) ─────────────────────────────
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string,
            { expand: ['items.data.price'] }
          )

          const priceId  = subscription.items.data[0]?.price.id
          const plan     = planFromPriceId(priceId)
          const interval = intervalFromPriceId(priceId)

          if (!plan) {
            console.error('[stripe webhook] Unknown price ID:', priceId)
            break
          }

          const periodEnd = getPeriodEnd(subscription)

          await updateUser(userId, {
            subscription_status:  plan,
            billing_interval:     interval,
            subscription_credits: PLAN_CREDITS[plan],
            credits_reset_at:     periodEnd
              ? new Date(periodEnd * 1000).toISOString()
              : null,
          })

          const paymentIntentId =
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null

          await createCreditPurchase({
            user_id: userId,
            amount: session.amount_total ?? 0,
            credits: PLAN_CREDITS[plan],
            type: 'subscription',
            stripe_payment_intent_id: paymentIntentId,
          })

          console.log(`[stripe webhook] Activated ${plan} (${interval}) for user ${userId}`)

          // ── Referral credit award ────────────────────────────────────────
          // Check whether this user was referred by someone. If a referral row
          // exists and credits haven't been awarded yet, award 10 top-up credits
          // to the referrer now. The atomic guard in awardReferralIfNotAwarded
          // prevents double-awarding even if this webhook is replayed.
          try {
            const referral = await getReferralForReferredUser(userId)
            if (referral && !referral.credits_awarded) {
              const awarded = await awardReferralIfNotAwarded(
                referral.id,
                referral.referrer_user_id,
              )
              if (awarded) {
                console.log(
                  `[stripe webhook] Awarded referral credits — referrer: ${referral.referrer_user_id}, ` +
                  `referred: ${userId}`
                )
              }
            }
          } catch (err) {
            // Referral award failure must never fail the webhook response —
            // Stripe would retry and could double-activate the subscription.
            console.error('[stripe webhook] Referral credit award error:', err)
          }
        }

        // ── mode: payment (top-up pack purchase) ────────────────────────────
        if (session.mode === 'payment') {
          const packId = session.metadata?.packId as TopupPackId | undefined
          if (!packId) {
            console.error('[stripe webhook] No packId on payment checkout session')
            break
          }

          const credits = TOPUP_CREDITS[packId]
          if (!credits) {
            console.error('[stripe webhook] Unknown packId:', packId)
            break
          }

          const paymentIntentId =
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? ''

          // ── Idempotency guard ────────────────────────────────────────────
          // Stripe may replay webhook events (network timeouts, retries).
          // Check whether this payment intent has already been processed to
          // prevent double-crediting.
          if (paymentIntentId) {
            const { data: alreadyProcessed } = await db
              .from('topup_purchases')
              .select('id')
              .eq('stripe_payment_intent_id', paymentIntentId)
              .maybeSingle()

            if (alreadyProcessed) {
              console.log(
                `[stripe webhook] Duplicate payment event ${paymentIntentId} — skipping`
              )
              break
            }
          }

          // Fetch current balance and add credits
          const { data: user } = await db
            .from('users')
            .select('topup_credits')
            .eq('id', userId)
            .single()

          if (user) {
            await updateUser(userId, {
              topup_credits: user.topup_credits + credits,
            })
          }

          await createTopupPurchase({
            user_id:                  userId,
            stripe_payment_intent_id: paymentIntentId,
            pack_name:                packId,
            credits_purchased:        credits,
            amount_paid:              session.amount_total ?? 0,
          })

          await createCreditPurchase({
            user_id: userId,
            amount: session.amount_total ?? 0,
            credits,
            type: 'topup',
            stripe_payment_intent_id: paymentIntentId || null,
          })

          console.log(
            `[stripe webhook] Top-up ${packId} (+${credits} credits) for user ${userId}`
          )
        }

        break
      }

      // ── customer.subscription.updated ──────────────────────────────────────
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const userId       = subscription.metadata?.userId

        if (!userId) {
          const customerId = subscription.customer as string
          const { data: user } = await db
            .from('users')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single()

          if (!user) {
            console.error('[stripe webhook] No user found for customer', customerId)
            break
          }
          await handleSubscriptionUpdate(user.id, subscription)
        } else {
          await handleSubscriptionUpdate(userId, subscription)
        }

        break
      }

      // ── customer.subscription.deleted ──────────────────────────────────────
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId   = subscription.customer as string

        const { data: user } = await db
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (!user) {
          console.error('[stripe webhook] No user found for customer', customerId)
          break
        }

        await updateUser(user.id, {
          subscription_status:  'cancelled',
          subscription_credits: 0,
        })

        console.log(`[stripe webhook] Subscription cancelled for user ${user.id}`)
        break
      }

      // ── invoice.paid (monthly / annual renewal) ────────────────────────────
      //
      // This event fires for every paid invoice, including:
      //   subscription_create  — first invoice (credits already set in checkout.session.completed)
      //   subscription_cycle   — regular renewal ← the only case we roll over credits
      //   subscription_update  — prorated plan change invoice ← skip
      //   manual               — admin-created ← skip
      //
      // Annual billing detail: Stripe fires subscription_cycle once per YEAR for
      // annual subscribers. Monthly credit grants for months 2-12 of an annual
      // billing period are handled by the /api/cron/credit-rollover route, which
      // runs monthly and processes users whose credits_reset_at has passed.
      // This handler sets credits_reset_at to ONE MONTH from now (not one year),
      // so the cron picks it up on the correct monthly cadence.
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice

        // Only process subscription renewal cycles (not creates, updates, or manual)
        if (invoice.billing_reason !== 'subscription_cycle') {
          console.log(
            `[stripe webhook] invoice.paid skipped — billing_reason: ${invoice.billing_reason}`
          )
          break
        }

        // ── 1. Resolve subscription and confirm it is still active in Stripe ──
        const subscriptionId = getInvoiceSubscriptionId(invoice)
        if (!subscriptionId) {
          console.error('[stripe webhook] invoice.paid: could not extract subscription ID')
          break
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items.data.price'],
        })

        // If the subscription was cancelled in Stripe before this invoice fired
        // (can happen with end-of-period cancellations), skip rollover.
        if (subscription.status !== 'active' && subscription.status !== 'trialing') {
          console.log(
            `[stripe webhook] invoice.paid: subscription ${subscriptionId} status is ` +
            `"${subscription.status}" — skipping rollover`
          )
          break
        }

        // ── 2. Derive plan and billing interval from the live subscription ─────
        // We read this from the Stripe subscription, not from our DB, so a
        // concurrent subscription.deleted event cannot produce stale data.
        const priceId  = subscription.items.data[0]?.price.id
        const plan     = planFromPriceId(priceId)
        const interval = intervalFromPriceId(priceId)

        if (!plan) {
          console.error('[stripe webhook] invoice.paid: unknown price ID', priceId)
          break
        }

        // ── 3. Find the user in our DB ─────────────────────────────────────────
        const customerId = invoice.customer as string
        const { data: user } = await db
          .from('users')
          .select('id, subscription_status, credits_reset_at')
          .eq('stripe_customer_id', customerId)
          .single()

        if (!user) {
          console.error('[stripe webhook] invoice.paid: no user for customer', customerId)
          break
        }

        // If our DB already shows the user as cancelled (e.g. subscription.deleted
        // fired first), skip rollover — no point crediting a cancelled account.
        if (user.subscription_status !== 'starter' && user.subscription_status !== 'pro') {
          console.log(
            `[stripe webhook] invoice.paid: user ${user.id} has status ` +
            `"${user.subscription_status}" in DB — skipping rollover`
          )
          break
        }

        // ── 4. Idempotency guard ───────────────────────────────────────────────
        // Stripe can replay webhooks. Guard using invoice.effective_at: if
        // credits_reset_at is already AFTER the invoice's effective date, the
        // rollover for this cycle has already been applied — skip.
        const invoiceEffectiveAt = (invoice as unknown as { effective_at?: number }).effective_at
          ?? invoice.created  // fallback: use created timestamp if effective_at not present
        const invoiceEffectiveMs = invoiceEffectiveAt * 1000

        if (user.credits_reset_at) {
          const resetAt = new Date(user.credits_reset_at).getTime()
          if (resetAt > invoiceEffectiveMs) {
            console.log(
              `[stripe webhook] invoice.paid: rollover already applied for user ${user.id} ` +
              `(credits_reset_at ${user.credits_reset_at} > invoice effective ${new Date(invoiceEffectiveMs).toISOString()}) — skipping`
            )
            break
          }
        }

        // ── 5. Apply rollover: subscription_credits = MIN(current + allowance, cap) ──
        const result = await applyMonthlyRollover(
          user.id,
          PLAN_CREDITS[plan],
          PLAN_ROLLOVER_CAP[plan]
        )

        // ── 6. Advance credits_reset_at ────────────────────────────────────────
        // For MONTHLY billing: use the subscription's next period end (from Stripe).
        // For ANNUAL billing: advance by exactly 1 calendar month, NOT 1 year.
        //   This ensures the monthly cron job (/api/cron/credit-rollover) picks up
        //   months 2-12 on the correct monthly cadence.
        let nextResetAt: string

        if (interval === 'monthly') {
          const periodEnd = getPeriodEnd(subscription)
          nextResetAt = periodEnd
            ? new Date(periodEnd * 1000).toISOString()
            : addOneMonth(new Date(invoiceEffectiveMs)).toISOString()
        } else {
          // Annual: advance from the invoice's effective date by 1 month
          nextResetAt = addOneMonth(new Date(invoiceEffectiveMs)).toISOString()
        }

        await updateUser(user.id, { credits_reset_at: nextResetAt })

        console.log(
          `[stripe webhook] Rollover applied — user: ${user.id}, plan: ${plan}, ` +
          `interval: ${interval}, +${PLAN_CREDITS[plan]} credits ` +
          `(new balance: ${result.subscription_credits}, cap: ${PLAN_ROLLOVER_CAP[plan]}), ` +
          `next reset: ${nextResetAt}`
        )
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error(`[stripe webhook] Error handling ${event.type}:`, err)
    return new Response('Webhook handler error', { status: 500 })
  }

  return new Response('OK', { status: 200 })
}

// ─── Shared subscription update helper ───────────────────────────────────────

async function handleSubscriptionUpdate(
  userId:       string,
  subscription: Stripe.Subscription
): Promise<void> {
  const priceId  = subscription.items.data[0]?.price.id
  const plan     = planFromPriceId(priceId)
  const interval = intervalFromPriceId(priceId)

  if (!plan) {
    console.error('[stripe webhook] Unknown price ID on subscription update:', priceId)
    return
  }

  const status: 'starter' | 'pro' | 'cancelled' =
    subscription.status === 'active' || subscription.status === 'trialing'
      ? plan
      : 'cancelled'

  const periodEnd = getPeriodEnd(subscription)

  const updates: Parameters<typeof updateUser>[1] = {
    subscription_status: status,
    billing_interval:    interval,
    credits_reset_at:    periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  }

  if (status === 'cancelled') {
    updates.subscription_credits = 0
  }

  await updateUser(userId, updates)

  console.log(
    `[stripe webhook] Subscription updated → ${status} (${interval}) for user ${userId}`
  )
}
