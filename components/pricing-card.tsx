'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BillingInterval, SubscriptionStatus } from '@/types'

interface PricingFeature {
  label:     string
  available: boolean
  note?:     string
}

interface PricingCardProps {
  plan:            'trial' | 'starter' | 'pro'
  interval:        BillingInterval
  currentPlan?:    SubscriptionStatus
  isAuthenticated: boolean
}

const PLAN_CONFIG = {
  trial: {
    name:         'Free Trial',
    monthlyPrice: null,
    annualPrice:  null,
    trialLabel:   '7 days free',
    credits:      '10 credits',
    rolloverCap:  null,
    highlighted:  false,
    ctaLabel:     'Start free trial',
    ctaHref:      '/sign-up',
  },
  starter: {
    name:         'Starter',
    monthlyPrice: 39,
    annualPrice:  390,
    annualSaving: 78,
    trialLabel:   null,
    credits:      '50 credits/month',
    rolloverCap:  'Rolls over up to 100',
    highlighted:  false,
    ctaLabel:     'Get Starter',
    ctaHref:      null,
  },
  pro: {
    name:         'Pro',
    monthlyPrice: 79,
    annualPrice:  790,
    annualSaving: 158,
    trialLabel:   null,
    credits:      '1,000 credits/month',
    rolloverCap:  'Rolls over up to 2,000',
    highlighted:  true,
    ctaLabel:     'Get Pro',
    ctaHref:      null,
  },
} as const

const FEATURES: Record<'trial' | 'starter' | 'pro', PricingFeature[]> = {
  trial: [
    { label: '10 credits',                    available: true },
    { label: 'All 6 platforms',               available: true },
    { label: 'Amazon, Etsy, eBay, Shopify, WooCommerce, TikTok Shop', available: true },
    { label: 'Priority generation',           available: false },
    { label: 'Bulk upload',                   available: false, note: 'Coming soon' },
  ],
  starter: [
    { label: '50 credits/month',              available: true },
    { label: 'All 6 platforms',               available: true },
    { label: 'Credits roll over (up to 100)', available: true },
    { label: 'Priority generation',           available: false },
    { label: 'Bulk upload',                   available: false, note: 'Coming soon' },
  ],
  pro: [
    { label: '1,000 credits/month',             available: true },
    { label: 'All 6 platforms',                 available: true },
    { label: 'Credits roll over (up to 2,000)', available: true },
    { label: 'Priority generation',             available: true },
    { label: 'Bulk upload',                     available: false, note: 'Coming soon' },
  ],
}

function isPaidPlan(p: 'trial' | 'starter' | 'pro'): p is 'starter' | 'pro' {
  return p === 'starter' || p === 'pro'
}

export function PricingCard({ plan, interval, currentPlan, isAuthenticated }: PricingCardProps) {
  const [loading, setLoading] = useState(false)
  const router    = useRouter()
  const config    = PLAN_CONFIG[plan]
  const features  = FEATURES[plan]

  const price = plan === 'trial'
    ? null
    : interval === 'annual'
      ? PLAN_CONFIG[plan as 'starter' | 'pro'].annualPrice
      : PLAN_CONFIG[plan as 'starter' | 'pro'].monthlyPrice

  const isCurrentPlan = !!currentPlan && currentPlan === plan
  const isHighlighted = config.highlighted

  async function handleCta() {
    if (plan === 'trial') { router.push('/sign-up'); return }
    if (!isAuthenticated) { router.push('/sign-up'); return }
    if (isCurrentPlan) return

    setLoading(true)
    try {
      const res  = await fetch('/api/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan, interval }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={`relative flex flex-col rounded-xl p-6 shadow-card transition-shadow duration-150 hover:shadow-card-hover ${
        isHighlighted
          ? 'bg-white border border-border border-t-[3px] border-t-accent'
          : 'bg-white border border-border'
      }`}
    >
      {isHighlighted && (
        <span className="self-start mb-2 text-xs font-medium bg-accent-light text-accent px-2.5 py-1 rounded-full">
          Most popular
        </span>
      )}

      {/* Plan name */}
      <h3 className="text-xl font-medium text-text-primary">{config.name}</h3>

      {/* Price */}
      <div className="mt-4 mb-6">
        {plan === 'trial' ? (
          <div className="text-3xl font-medium text-text-primary">
            {config.trialLabel}
          </div>
        ) : (
          <>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-medium text-text-primary">
                £{price}
              </span>
              <span className="text-text-secondary text-sm mb-1.5">
                /{interval === 'annual' ? 'year' : 'month'}
              </span>
            </div>
            {interval === 'annual' && isPaidPlan(plan) && (
              <p className="text-success text-sm mt-1">
                Save £{PLAN_CONFIG[plan].annualSaving} vs monthly
              </p>
            )}
            {interval === 'monthly' && isPaidPlan(plan) && (
              <p className="text-text-secondary text-xs mt-1">
                or £{PLAN_CONFIG[plan].annualPrice}/year (save 2 months)
              </p>
            )}
          </>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-3 flex-1 mb-6">
        {features.map((f) => (
          <li key={f.label} className="flex items-start gap-2.5 text-sm">
            {f.available ? (
              <span className="text-success mt-0.5 shrink-0">✓</span>
            ) : (
              <span className="text-text-disabled mt-0.5 shrink-0">—</span>
            )}
            <span className={f.available ? 'text-text-primary' : 'text-text-secondary'}>
              {f.label}
              {f.note && (
                <span className="ml-1.5 text-xs text-text-disabled font-mono">
                  {f.note}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={handleCta}
        disabled={loading || isCurrentPlan}
        className={`w-full font-medium rounded-lg px-5 py-2.5 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
          isHighlighted
            ? 'bg-accent hover:bg-accent-hover text-white'
            : 'bg-[#1A1814] hover:bg-[#2D2A25] text-white'
        }`}
      >
        {loading ? 'Redirecting…' : isCurrentPlan ? 'Current plan' : config.ctaLabel}
      </button>
    </div>
  )
}
