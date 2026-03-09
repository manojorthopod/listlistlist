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
import { db, updateUser, createTopupPurchase, applyMonthlyRollover } from '@/lib/db'
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

          console.log(`[stripe webhook] Activated ${plan} (${interval}) for user ${userId}`)
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
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice

        // Only process subscription renewal cycles
        if (invoice.billing_reason !== 'subscription_cycle') break

        const customerId = invoice.customer as string
        const { data: user } = await db
          .from('users')
          .select('id, subscription_status')
          .eq('stripe_customer_id', customerId)
          .single()

        if (!user) {
          console.error('[stripe webhook] No user found for customer', customerId)
          break
        }

        const plan = user.subscription_status as 'starter' | 'pro'
        if (plan !== 'starter' && plan !== 'pro') break

        await applyMonthlyRollover(user.id, PLAN_CREDITS[plan], PLAN_ROLLOVER_CAP[plan])

        // Update next reset date from the subscription
        const subscriptionId = getInvoiceSubscriptionId(invoice)
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const periodEnd    = getPeriodEnd(subscription)
          if (periodEnd) {
            await updateUser(user.id, {
              credits_reset_at: new Date(periodEnd * 1000).toISOString(),
            })
          }
        }

        console.log(
          `[stripe webhook] Rollover applied for user ${user.id} (${plan}, +${PLAN_CREDITS[plan]} up to cap ${PLAN_ROLLOVER_CAP[plan]})`
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
