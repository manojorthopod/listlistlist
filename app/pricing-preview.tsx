'use client'

import { useState } from 'react'
import { CheckIcon } from 'lucide-react'
import Link from 'next/link'
import { BillingToggle } from '@/components/billing-toggle'
import type { BillingInterval } from '@/types'

const PLANS = [
  {
    id:           'trial',
    name:         'Free Trial',
    monthly:      null,
    annual:       null,
    trialBadge:   '7 days free',
    credits:      '10 credits',
    features:     ['All 6 platforms', 'No credit card needed'],
    cta:          'Start free trial',
    href:         '/sign-up',
    highlight:    false,
  },
  {
    id:           'starter',
    name:         'Starter',
    monthly:      39,
    annual:       390,
    annualSaving: 78,
    trialBadge:   null,
    credits:      '50 credits/month',
    features:     ['All 6 platforms', 'Credits roll over (cap: 100)', 'Top-up packs available'],
    cta:          'Get Starter',
    href:         '/sign-up',
    highlight:    false,
  },
  {
    id:           'pro',
    name:         'Pro',
    monthly:      79,
    annual:       790,
    annualSaving: 158,
    trialBadge:   null,
    credits:      '1,000 credits/month',
    features:     ['All 6 platforms', 'Credits roll over (cap: 2,000)', 'Priority generation', 'Bulk upload — coming soon'],
    cta:          'Get Pro',
    href:         '/sign-up',
    highlight:    true,
  },
] as const

export default function PricingPreview() {
  const [interval, setInterval] = useState<BillingInterval>('monthly')

  return (
    <div className="space-y-8">
      {/* Toggle */}
      <div className="flex justify-center">
        <BillingToggle value={interval} onChange={setInterval} />
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PLANS.map((plan) => {
          const price = plan.monthly === null
            ? null
            : interval === 'annual'
              ? plan.annual
              : plan.monthly

          const saving = interval === 'annual' && 'annualSaving' in plan ? plan.annualSaving : null

          return (
            <div
              key={plan.id}
              className={`
                rounded-xl p-6 space-y-5 flex flex-col shadow-card
                ${plan.highlight
                  ? 'border border-border border-t-[3px] border-t-accent bg-white'
                  : 'border border-border bg-surface'}
              `}
            >
              {plan.highlight && (
                <span className="self-start text-xs font-medium bg-accent text-white px-2.5 py-1 rounded-full">
                  Most popular
                </span>
              )}

              <div>
                <h3 className="text-lg font-medium text-text-primary">{plan.name}</h3>
                <div className="mt-2">
                  {price !== null ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-medium text-text-primary">£{price}</span>
                      <span className="text-text-secondary text-sm">
                        /{interval === 'annual' ? 'year' : 'month'}
                      </span>
                      {saving && (
                        <span className="ml-2 text-xs font-medium text-success">
                          save £{saving}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-2xl font-medium text-text-primary">
                      {plan.trialBadge}
                    </span>
                  )}
                  <p className="text-sm text-accent font-medium mt-1">{plan.credits}</p>
                </div>
              </div>

              <ul className="space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                    <CheckIcon className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`
                  w-full text-center font-medium rounded-lg px-4 py-2.5 text-sm
                  transition-colors duration-150
                  ${plan.highlight
                    ? 'bg-accent hover:bg-accent-hover text-white'
                    : 'bg-[#1A1814] hover:bg-[#2D2A25] text-white'}
                `}
              >
                {plan.cta}
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
