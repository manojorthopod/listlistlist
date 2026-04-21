import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import {
  CoinsIcon,
  ZapIcon,
  UsersIcon,
  ReceiptIcon,
  SlidersHorizontalIcon,
} from 'lucide-react'

import { getUserById, getCreditPurchasesByUser } from '@/lib/db'
import { TOPUP_PACKS, type User } from '@/types'

import CreditBadge from '@/components/credit-badge'
import { TopupPackCard } from '@/components/topup-pack-card'
import ReferralWidget from '@/components/referral-widget'
import SignOutButton from '@/components/sign-out-button'

import { TopupSuccessBanner }      from '@/app/account/topup-success-banner'
import { ManageSubscriptionButton } from '@/app/account/manage-subscription-button'
import { PlatformPreferences }      from '@/app/account/platform-preferences'
import { BrandVoiceEditor }         from '@/app/account/brand-voice-editor'
import { BillingHistory }           from '@/app/account/billing-history'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function planLabel(status: User['subscription_status']): string {
  switch (status) {
    case 'trial':     return 'Free trial'
    case 'starter':   return 'Starter'
    case 'pro':       return 'Pro'
    case 'cancelled': return 'Cancelled'
  }
}

function trialDaysRemaining(user: User): number | null {
  if (user.subscription_status !== 'trial' || !user.trial_started_at) return null
  const elapsed = Math.floor(
    (Date.now() - new Date(user.trial_started_at).getTime()) / (1000 * 60 * 60 * 24)
  )
  return Math.max(0, 7 - elapsed)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ─── Plan & billing card ──────────────────────────────────────────────────────

function PlanCard({ user }: { user: User }) {
  const daysLeft  = trialDaysRemaining(user)
  const urgent    = daysLeft !== null && daysLeft <= 2
  const trialExpired = user.subscription_status === 'trial' && daysLeft === 0
  const isPaying  = user.subscription_status === 'starter' || user.subscription_status === 'pro'

  const statusColour: Record<User['subscription_status'], string> = {
    trial:     urgent
      ? 'bg-[#FEF3C7] text-[#92400E]'
      : 'bg-accent-muted border-accent text-accent',
    starter:   'bg-surface-2 border-border-2 text-text-secondary',
    pro:       'bg-accent-muted border-accent text-accent',
    cancelled: 'bg-error-muted border-error text-error',
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0">
          <ZapIcon className="w-4 h-4 text-accent" />
        </div>
        <h2 className="text-base font-medium text-text-primary">Plan &amp; billing</h2>
      </div>

      {/* Plan badge */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div
          className={`
            inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold
            ${trialExpired ? '' : 'border'}
            ${statusColour[user.subscription_status]}
          `}
        >
          {planLabel(user.subscription_status)}
          {user.subscription_status === 'trial' && daysLeft !== null && (
            <span className="ml-1.5 opacity-80 font-normal">
              — {daysLeft === 0 ? 'expired' : `${daysLeft}d left`}
            </span>
          )}
        </div>

        {isPaying && (
          <span className="text-xs text-text-secondary capitalize">
            {user.billing_interval} billing
          </span>
        )}
      </div>

      {/* Details */}
      <dl className="space-y-2 text-sm">
        {isPaying && user.credits_reset_at && (
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">Next credit renewal</dt>
            <dd className="text-text-primary font-medium">{formatDate(user.credits_reset_at)}</dd>
          </div>
        )}
        {user.subscription_status === 'trial' && user.trial_started_at && (
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">Trial started</dt>
            <dd className="text-text-primary font-medium">{formatDate(user.trial_started_at)}</dd>
          </div>
        )}
        {user.subscription_status === 'cancelled' && (
          <p className="text-xs text-text-secondary">
            Your subscription has ended. Saved listings remain accessible.
          </p>
        )}
      </dl>

      {/* Actions */}
      <div className="pt-1 space-y-3">
        {isPaying ? (
          <ManageSubscriptionButton hasStripeAccount={!!user.stripe_customer_id} />
        ) : (
          <Link
            href="/pricing"
            className="
              inline-flex items-center gap-2
              bg-[#1A1814] hover:bg-[#2D2A25] text-white font-medium
              rounded-lg px-4 py-2.5 text-sm
              transition-colors duration-150
            "
          >
            <ZapIcon className="w-4 h-4" />
            {user.subscription_status === 'cancelled' ? 'Choose a plan' : 'Upgrade now'}
          </Link>
        )}
      </div>
    </div>
  )
}

// ─── Credits card ─────────────────────────────────────────────────────────────

function CreditsCard({ user }: { user: User }) {
  const planAllowance = user.subscription_status === 'trial'
    ? 10
    : user.subscription_status === 'starter'
      ? 50
      : user.subscription_status === 'pro'
        ? 1000
        : 0
  const fillPct  = planAllowance > 0 ? Math.min(100, (user.subscription_credits / planAllowance) * 100) : 0
  const total    = user.subscription_credits + user.topup_credits
  const isLow    = user.subscription_credits <= 5 && user.subscription_status !== 'cancelled'

  return (
    <div className="bg-surface border border-border rounded-xl p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0">
          <CoinsIcon className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h2 className="text-base font-medium text-text-primary">Credits</h2>
          <p className="text-xs text-text-secondary mt-0.5">{total} total available</p>
        </div>
      </div>

      {/* Monthly credits row */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
            <span className="text-text-secondary">Monthly credits</span>
          </div>
          <span className={`font-semibold tabular-nums ${isLow ? 'text-warning' : 'text-text-primary'}`}>
            {user.subscription_credits}
          </span>
        </div>

        {/* Progress bar vs plan allowance */}
        {planAllowance > 0 && (
          <>
            <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-warning' : 'bg-accent'}`}
                style={{ width: `${fillPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-text-disabled">
              <span>{user.subscription_credits} remaining</span>
              <span>{planAllowance} monthly allowance</span>
            </div>
          </>
        )}

        {user.credits_reset_at && (
          <p className="text-xs text-text-disabled">
            Resets {new Date(user.credits_reset_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short',
            })}
          </p>
        )}
      </div>

      {/* Top-up credits row */}
      <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-text-secondary flex-shrink-0" />
          <span className="text-text-secondary">Top-up credits</span>
        </div>
        <div className="text-right">
          <span className="font-semibold text-text-primary tabular-nums">{user.topup_credits}</span>
          <p className="text-xs text-text-disabled mt-0.5">Never expire</p>
        </div>
      </div>

      {/* Low credits warning */}
      {isLow && (
        <div className="flex items-center gap-2 rounded-lg bg-warning-muted border border-warning px-3 py-2 text-xs text-warning">
          Running low. Buy a top-up pack or wait for your renewal date.
        </div>
      )}
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center flex-shrink-0 text-text-secondary">
          {icon}
        </div>
        <h2 className="text-base font-medium text-text-primary">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AccountPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const [user, purchases] = await Promise.all([
    getUserById(userId),
    getCreditPurchasesByUser(userId),
  ])

  if (!user) redirect('/sign-in')

  return (
    <div className="min-h-screen bg-base">

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav className="border-b border-border bg-surface sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/">
            <img src="/logo.svg" alt="listlistlist" style={{ height: '40px', width: 'auto' }} />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-150"
            >
              Dashboard
            </Link>
            <Link
              href="/account"
              className="text-sm text-text-primary font-medium border-b border-accent pb-0.5"
            >
              Account
            </Link>
            <SignOutButton />
            <CreditBadge />
          </div>
        </div>
      </nav>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-8">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-text-primary">Account</h1>
          <p className="text-text-secondary text-sm mt-1">{user.email}</p>
        </div>

        {/* ── Topup success banner — client component reads URL param ───────── */}
        <Suspense fallback={null}>
          <TopupSuccessBanner />
        </Suspense>

        {/* ── Two-column layout ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* ── Left column (main, 2/3) ───────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Credits overview */}
            <CreditsCard user={user} />

            {/* Buy more credits */}
            <Section
              title="Buy credits"
              icon={<CoinsIcon className="w-4 h-4" />}
            >
              <p className="text-xs text-text-secondary -mt-2">
                Top-up credits never expire and are used after your monthly credits.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {TOPUP_PACKS.map((pack) => (
                  <TopupPackCard key={pack.id} pack={pack} isAuthenticated />
                ))}
              </div>
            </Section>

            {/* Billing history */}
            <Section
              title="Purchase history"
              icon={<ReceiptIcon className="w-4 h-4" />}
            >
              <BillingHistory purchases={purchases} />
            </Section>

          </div>

          {/* ── Right sidebar (1/3) ───────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Plan & billing */}
            <PlanCard user={user} />

            {/* Platform preferences */}
            <Section
              title="Preferred platforms"
              icon={<SlidersHorizontalIcon className="w-4 h-4" />}
            >
              <p className="text-xs text-text-secondary -mt-2">
                These are pre-selected when you start a new listing.
              </p>
              <PlatformPreferences initialPlatforms={user.preferred_platforms} />
            </Section>

            {/* Brand voice */}
            <Section
              title="Brand voice"
              icon={
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                  <path d="M2 4a1 1 0 011-1h10a1 1 0 010 2H3a1 1 0 01-1-1zm0 4a1 1 0 011-1h10a1 1 0 010 2H3a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 010 2H3a1 1 0 01-1-1z" />
                </svg>
              }
            >
              <p className="text-xs text-text-secondary -mt-2">
                Describe your tone in a few words. Applied to all your listings.
              </p>
              <BrandVoiceEditor initialValue={user.brand_voice} />
            </Section>

            {/* Referral */}
            <Section
              title="Refer a seller"
              icon={<UsersIcon className="w-4 h-4" />}
            >
              <ReferralWidget />
            </Section>

          </div>
        </div>

        {/* ── Session actions ──────────────────────────────────────────────── */}
        <div className="pt-2 border-t border-border">
          <div className="bg-surface border border-border rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-text-primary">Signed in as {user.email}</p>
              <p className="text-xs text-text-secondary mt-1">
                Sign out to end this session on this device.
              </p>
            </div>
            <SignOutButton variant="primary" />
          </div>
        </div>
      </div>
    </div>
  )
}
