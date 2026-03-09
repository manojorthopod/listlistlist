import Stripe from 'stripe'
import type { BillingInterval, SubscriptionStatus, TopupPackId } from '@/types'

// ─── Client ───────────────────────────────────────────────────────────────────

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY environment variable')
  return new Stripe(key, { apiVersion: '2026-02-25.clover' })
}

export const stripe = getStripeClient()

// ─── Price ID helpers ─────────────────────────────────────────────────────────

export function getSubscriptionPriceId(
  plan: 'starter' | 'pro',
  interval: BillingInterval
): string {
  const map: Record<string, string | undefined> = {
    starter_monthly: process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID,
    starter_annual:  process.env.NEXT_PUBLIC_STRIPE_STARTER_ANNUAL_PRICE_ID,
    pro_monthly:     process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
    pro_annual:      process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID,
  }
  const key = `${plan}_${interval}`
  const priceId = map[key]
  if (!priceId) throw new Error(`Missing Stripe price ID for ${key}`)
  return priceId
}

export function getTopupPriceId(packId: TopupPackId): string {
  const map: Record<TopupPackId, string | undefined> = {
    starter_pack: process.env.NEXT_PUBLIC_STRIPE_TOPUP_STARTER_PRICE_ID,
    growth_pack:  process.env.NEXT_PUBLIC_STRIPE_TOPUP_GROWTH_PRICE_ID,
    scale_pack:   process.env.NEXT_PUBLIC_STRIPE_TOPUP_SCALE_PRICE_ID,
  }
  const priceId = map[packId]
  if (!priceId) throw new Error(`Missing Stripe price ID for topup ${packId}`)
  return priceId
}

// ─── Plan metadata ────────────────────────────────────────────────────────────

// Monthly credit allowance per plan (mirrors types/index.ts PLAN_MONTHLY_CREDITS)
export const PLAN_CREDITS: Record<'starter' | 'pro', number> = {
  starter: 50,
  pro:     1000,
}

export const PLAN_ROLLOVER_CAP: Record<'starter' | 'pro', number> = {
  starter: 100,
  pro:     2000,
}

// Map a Stripe price ID → the subscription plan name
export function planFromPriceId(priceId: string): 'starter' | 'pro' | null {
  const starterIds = [
    process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_STARTER_ANNUAL_PRICE_ID,
  ]
  const proIds = [
    process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID,
  ]
  if (starterIds.includes(priceId)) return 'starter'
  if (proIds.includes(priceId))     return 'pro'
  return null
}

// Map a Stripe price ID → billing interval
export function intervalFromPriceId(priceId: string): BillingInterval {
  const annualIds = [
    process.env.NEXT_PUBLIC_STRIPE_STARTER_ANNUAL_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID,
  ]
  return annualIds.includes(priceId) ? 'annual' : 'monthly'
}

// Map a Stripe price ID → topup pack ID
export function topupPackFromPriceId(priceId: string): TopupPackId | null {
  const map: Record<string, TopupPackId> = {}
  if (process.env.NEXT_PUBLIC_STRIPE_TOPUP_STARTER_PRICE_ID)
    map[process.env.NEXT_PUBLIC_STRIPE_TOPUP_STARTER_PRICE_ID] = 'starter_pack'
  if (process.env.NEXT_PUBLIC_STRIPE_TOPUP_GROWTH_PRICE_ID)
    map[process.env.NEXT_PUBLIC_STRIPE_TOPUP_GROWTH_PRICE_ID]  = 'growth_pack'
  if (process.env.NEXT_PUBLIC_STRIPE_TOPUP_SCALE_PRICE_ID)
    map[process.env.NEXT_PUBLIC_STRIPE_TOPUP_SCALE_PRICE_ID]   = 'scale_pack'
  return map[priceId] ?? null
}

// Credits per topup pack
export const TOPUP_CREDITS: Record<TopupPackId, number> = {
  starter_pack: 100,
  growth_pack:  300,
  scale_pack:   700,
}

// ─── Checkout helpers ─────────────────────────────────────────────────────────

export async function createSubscriptionCheckout(opts: {
  userId:          string
  userEmail:       string
  stripeCustomerId: string | null
  plan:            'starter' | 'pro'
  interval:        BillingInterval
  appUrl:          string
}): Promise<string> {
  const priceId = getSubscriptionPriceId(opts.plan, opts.interval)

  const session = await stripe.checkout.sessions.create({
    mode:               'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    customer:           opts.stripeCustomerId ?? undefined,
    customer_email:     opts.stripeCustomerId ? undefined : opts.userEmail,
    client_reference_id: opts.userId,
    success_url:        `${opts.appUrl}/dashboard?checkout=success`,
    cancel_url:         `${opts.appUrl}/pricing`,
    subscription_data: {
      metadata: { userId: opts.userId, plan: opts.plan },
    },
    metadata: { userId: opts.userId },
  })

  if (!session.url) throw new Error('Stripe checkout session has no URL')
  return session.url
}

export async function createTopupCheckout(opts: {
  userId:          string
  userEmail:       string
  stripeCustomerId: string | null
  packId:          TopupPackId
  appUrl:          string
}): Promise<string> {
  const priceId = getTopupPriceId(opts.packId)

  const session = await stripe.checkout.sessions.create({
    mode:               'payment',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    customer:           opts.stripeCustomerId ?? undefined,
    customer_email:     opts.stripeCustomerId ? undefined : opts.userEmail,
    client_reference_id: opts.userId,
    success_url:        `${opts.appUrl}/account?topup=success`,
    cancel_url:         `${opts.appUrl}/account`,
    metadata: { userId: opts.userId, packId: opts.packId },
  })

  if (!session.url) throw new Error('Stripe checkout session has no URL')
  return session.url
}

// ─── Customer portal ──────────────────────────────────────────────────────────

export async function createPortalSession(opts: {
  stripeCustomerId: string
  appUrl:           string
}): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer:   opts.stripeCustomerId,
    return_url: `${opts.appUrl}/account`,
  })
  return session.url
}
