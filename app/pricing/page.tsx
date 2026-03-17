'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { BillingToggle } from '@/components/billing-toggle'
import { PricingCard } from '@/components/pricing-card'
import { TopupPackCard } from '@/components/topup-pack-card'
import { TOPUP_PACKS } from '@/types'
import type { BillingInterval } from '@/types'

const FAQ_ITEMS = [
  {
    q: 'Will Amazon flag AI-generated listings?',
    a: "Amazon monitors listings for unverified claims and fabricated specs. listlistlist never generates dimensions or data that wasn't in your confirmed product details, and the output validator strips any markdown artefacts before you see the copy. That said, always review before publishing — especially bullets and title.",
  },
  {
    q: 'What if the AI gets the product details wrong?',
    a: 'Before any listing is generated you see every extracted field — product type, material, colour, condition, features — and can edit them. Nothing generates until you confirm. Accurate confirmation screen = accurate listings.',
  },
  {
    q: 'Do credits expire?',
    a: 'Monthly subscription credits roll over to the next month, capped at 2× your monthly allowance (100 for Starter, 2,000 for Pro). Top-up credits purchased separately never expire.',
  },
  {
    q: 'Can I switch between monthly and annual billing?',
    a: 'Yes. Manage your billing interval any time via the Stripe Customer Portal in your account settings.',
  },
  {
    q: 'What counts as one credit?',
    a: "One credit = one platform listing generated. Uploading a photo costs zero credits. If you generate listings for 4 platforms in one session, that's 4 credits. Failed platforms are automatically refunded.",
  },
  {
    q: 'What is TikTok Shop?',
    a: "TikTok Shop is a fast-growing marketplace embedded inside TikTok. listlistlist generates hook-first listings, hashtags, and a short video script opener optimised for TikTok's discovery algorithm — different from every other platform.",
  },
]

export default function PricingPage() {
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const { isSignedIn } = useAuth()

  return (
    <div className="min-h-screen bg-base">
      {/* Nav */}
      <nav className="border-b border-border bg-white">
        <div className="max-w-content mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <img src="/logo.svg" alt="listlistlist" style={{ height: '40px', width: 'auto' }} />
          </Link>
          <div className="flex items-center gap-4">
            {isSignedIn ? (
              <Link
                href="/dashboard"
                className="border border-border hover:border-border-2 bg-white hover:bg-surface-2 text-text-primary font-medium rounded-lg px-4 py-2 text-sm transition-colors duration-150 shadow-card"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/sign-in" className="text-text-secondary hover:text-text-primary text-sm transition-colors duration-150">
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="bg-[#1A1814] hover:bg-[#2D2A25] text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors duration-150"
                >
                  Start free trial
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-content mx-auto px-6 py-16">

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-medium tracking-tight text-text-primary">
            Straightforward pricing
          </h1>
          <p className="mt-4 text-text-secondary text-lg max-w-xl mx-auto">
            Start with a 7-day free trial. No card required.
          </p>
          <div className="mt-8 flex justify-center">
            <BillingToggle value={interval} onChange={setInterval} />
          </div>
        </div>

        {/* Subscription tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-20">
          <PricingCard plan="trial"   interval={interval} isAuthenticated={!!isSignedIn} />
          <PricingCard plan="starter" interval={interval} isAuthenticated={!!isSignedIn} />
          <PricingCard plan="pro"     interval={interval} isAuthenticated={!!isSignedIn} />
        </div>

        {/* Top-up packs */}
        <div className="mb-20">
          <div className="mb-8">
            <h2 className="text-3xl font-medium tracking-tight text-text-primary">
              Top-up credit packs
            </h2>
            <p className="mt-2 text-text-secondary text-base">
              Need more credits without upgrading? Buy once — they never expire and are used
              after your monthly credits.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TOPUP_PACKS.map((pack) => (
              <TopupPackCard
                key={pack.id}
                pack={pack}
                isAuthenticated={!!isSignedIn}
              />
            ))}
          </div>

          <p className="mt-4 text-text-secondary text-sm">
            Top-up packs are a one-time purchase, not a subscription. Credits are added to your
            account instantly after payment.
          </p>
        </div>

        {/* Platform support callout */}
        <div className="bg-white border border-border rounded-xl p-8 mb-20 shadow-card">
          <h2 className="text-xl font-medium text-text-primary mb-4">
            Every plan includes all 6 platforms
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { name: 'Amazon',      color: '#FF9900' },
              { name: 'Etsy',        color: '#F1641E' },
              { name: 'eBay',        color: '#E53238' },
              { name: 'Shopify',     color: '#96BF48' },
              { name: 'WooCommerce', color: '#7F54B3' },
              { name: 'TikTok Shop', color: '#FF004F' },
            ].map((p) => (
              <div
                key={p.name}
                className="bg-surface-2 border border-border rounded-lg p-3 text-center"
              >
                <span className="text-sm font-medium" style={{ color: p.color }}>{p.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-16">
          <h2 className="text-3xl font-medium tracking-tight text-text-primary mb-8">
            Common questions
          </h2>
          <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-white shadow-card">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i}>
                <button
                  className="w-full text-left px-6 py-4 flex items-center justify-between gap-4 hover:bg-surface-2 transition-colors duration-150"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="text-text-primary font-medium">{item.q}</span>
                  <span className={`text-text-secondary shrink-0 transition-transform duration-150 text-lg leading-none ${openFaq === i ? 'rotate-45' : ''}`}>
                    +
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-text-secondary text-sm leading-relaxed border-t border-border bg-surface-2">
                    <p className="pt-4">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        {!isSignedIn && (
          <div className="text-center bg-white border border-border rounded-2xl p-12 shadow-card">
            <h2 className="text-3xl font-medium tracking-tight text-text-primary">
              Ready to stop writing listings manually?
            </h2>
            <p className="mt-3 text-text-secondary">
              7-day free trial. 10 credits. No card required.
            </p>
            <Link
              href="/sign-up"
              className="inline-block mt-6 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg px-6 py-3 transition-colors duration-150"
            >
              Start your free trial
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
