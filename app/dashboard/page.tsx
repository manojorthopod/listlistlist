import { auth, currentUser } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ZapIcon, CoinsIcon, PlusIcon } from 'lucide-react'
import { getUserById, upsertUser, getListingsByUser, withTimeout } from '@/lib/db'
import { PLAN_ROLLOVER_CAP } from '@/types'
import { isValidReferralCode } from '@/lib/referral'
import CreditBadge from '@/components/credit-badge'
import ReferralWidget from '@/components/referral-widget'
import ReferralRecorder from '@/app/dashboard/referral-recorder'
import ListingsGrid from '@/app/dashboard/listings-grid'
import type { User } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trialDaysRemaining(user: User): number | null {
  if (user.subscription_status !== 'trial' || !user.trial_started_at) return null
  const started = new Date(user.trial_started_at).getTime()
  const now     = Date.now()
  const elapsed = Math.floor((now - started) / (1000 * 60 * 60 * 24))
  return Math.max(0, 7 - elapsed)
}

function planLabel(user: User): string {
  switch (user.subscription_status) {
    case 'trial':     return 'Free trial'
    case 'starter':   return 'Starter'
    case 'pro':       return 'Pro'
    case 'cancelled': return 'Cancelled'
  }
}

// ─── Plan badge ───────────────────────────────────────────────────────────────

function PlanBadge({ user }: { user: User }) {
  const daysLeft = trialDaysRemaining(user)
  const urgent   = daysLeft !== null && daysLeft <= 2

  if (user.subscription_status === 'trial') {
    return (
      <div
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border
          ${urgent
            ? 'bg-warning-muted border-warning text-warning'
            : 'bg-accent-muted border-accent text-accent'}
        `}
      >
        {daysLeft === 0 ? 'Trial expired' : `Trial — ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
        {urgent && daysLeft! > 0 && (
          <Link
            href="/pricing"
            className="ml-2 underline underline-offset-2 text-xs font-medium opacity-90 hover:opacity-100"
          >
            Upgrade
          </Link>
        )}
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    starter:   'bg-surface-2 border-border-2 text-text-secondary',
    pro:       'bg-accent-muted border-accent text-accent',
    cancelled: 'bg-error-muted border-error text-error',
  }

  return (
    <div
      className={`
        inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold border
        ${statusColors[user.subscription_status] ?? statusColors.starter}
      `}
    >
      {planLabel(user)}
    </div>
  )
}

// ─── Credit summary card ──────────────────────────────────────────────────────

function CreditSummary({ user }: { user: User }) {
  const total       = user.subscription_credits + user.topup_credits
  const cap         = PLAN_ROLLOVER_CAP[user.subscription_status]
  const fillPct     = cap > 0 ? Math.min(100, (user.subscription_credits / cap) * 100) : 0
  const isLow       = user.subscription_credits <= 5

  return (
    <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0">
            <CoinsIcon className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">Credits</h3>
            <p className="text-xs text-text-secondary mt-0.5">{total} total available</p>
          </div>
        </div>
        <Link
          href="/account"
          className="
            text-xs font-medium text-accent hover:text-accent-light
            transition-colors duration-150
          "
        >
          Buy more →
        </Link>
      </div>

      {/* Split display */}
      <div className="flex items-center gap-4">
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-text-secondary">Monthly</span>
            </div>
            <span className={`font-semibold ${isLow ? 'text-warning' : 'text-text-primary'}`}>
              {user.subscription_credits}
            </span>
          </div>
          {/* Progress bar */}
          {cap > 0 && (
            <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-warning' : 'bg-accent'}`}
                style={{ width: `${fillPct}%` }}
              />
            </div>
          )}
          {user.credits_reset_at && (
            <p className="text-xs text-text-disabled">
              Resets{' '}
              {new Date(user.credits_reset_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short',
              })}
            </p>
          )}
        </div>

        {user.topup_credits > 0 && (
          <>
            <div className="w-px h-10 bg-border" />
            <div className="space-y-1 text-right">
              <div className="flex items-center justify-end gap-1.5 text-sm">
                <span className="w-2 h-2 rounded-full bg-text-secondary" />
                <span className="text-text-secondary">Top-up</span>
                <span className="font-semibold text-text-primary">{user.topup_credits}</span>
              </div>
              <p className="text-xs text-text-disabled">Never expires</p>
            </div>
          </>
        )}
      </div>

      {isLow && user.subscription_credits > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-warning-muted border border-warning px-3 py-2 text-xs text-warning">
          Running low. Top up or wait for your renewal date.
        </div>
      )}
    </div>
  )
}

// ─── Bulk upload placeholder ──────────────────────────────────────────────────

function BulkUploadPlaceholder({ plan }: { plan: User['subscription_status'] }) {
  if (plan === 'trial' || plan === 'cancelled') return null
  return (
    <div
      className="
        flex items-center justify-between gap-4
        bg-surface border border-border rounded-xl px-5 py-4
        opacity-60
      "
    >
      <div>
        <p className="text-sm font-semibold text-text-primary">Bulk upload</p>
        <p className="text-xs text-text-secondary mt-0.5">Upload up to 10 images at once</p>
      </div>
      <span className="flex-shrink-0 text-xs font-semibold border border-border-2 text-text-secondary rounded-full px-2.5 py-1">
        Coming soon
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const cookieStore = await cookies()
  const rawRefCode  = cookieStore.get('referral_code')?.value ?? null
  // Only pass a code that passes our format check — never forward arbitrary cookie values
  const pendingReferralCode = rawRefCode && isValidReferralCode(rawRefCode) ? rawRefCode : null

  const DB_TIMEOUT = 5000

  const [initialUser, listings] = await Promise.all([
    withTimeout(getUserById(userId),           DB_TIMEOUT, 'getUserById'),
    withTimeout(getListingsByUser(userId, 0, 10), DB_TIMEOUT, 'getListingsByUser'),
  ])
  let user = initialUser

  // The Clerk webhook may not have fired yet in local development (webhooks
  // require a public tunnel like ngrok to reach localhost). If the Supabase
  // row doesn't exist yet, create it on-the-fly so the user isn't stuck in a
  // redirect loop. In production the webhook will have already created the row
  // by the time the user reaches the dashboard, so this is a no-op there.
  if (!user) {
    const clerkUser = await withTimeout(
      currentUser(),
      DB_TIMEOUT,
      'currentUser'
    )
    if (!clerkUser) redirect('/sign-in')

    const email =
      clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      )?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      ''

    try {
      user = await withTimeout(
        upsertUser(userId, email),
        DB_TIMEOUT,
        'upsertUser'
      )
    } catch (err) {
      console.error('[dashboard] Failed to create user row on-the-fly:', err)
      // Do NOT redirect('/sign-in') here — if the DB is unreachable that
      // creates an infinite redirect loop (Clerk sends the user back to
      // /dashboard, which hits the DB again, fails, redirects, repeat).
    }
  }

  // If user is still null after the fallback (DB unreachable / wrong key),
  // show an actionable error page rather than looping.
  if (!user) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-surface border border-error rounded-xl p-8 space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-error-muted border border-error flex items-center justify-center mx-auto">
            <span className="text-error text-xl font-bold">!</span>
          </div>
          <h1 className="text-xl font-semibold text-text-primary">
            Database connection error
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            We couldn&apos;t load your account data. This usually means the
            Supabase service role key in <code className="text-accent">.env.local</code> is
            incorrect. Copy the <strong>service_role</strong> key (starts with{' '}
            <code className="text-accent">eyJ</code>) from{' '}
            <strong>Supabase Dashboard → Project Settings → API</strong> and
            restart the dev server.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center w-full bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors duration-150"
          >
            Try again
          </a>
        </div>
      </div>
    )
  }

  const daysLeft = trialDaysRemaining(user)

  return (
    <div className="min-h-screen bg-base">

      {/* ── Referral attribution (no UI) ───────────────────────────────────── */}
      {pendingReferralCode && <ReferralRecorder referralCode={pendingReferralCode} />}

      {/* ── Top navigation ─────────────────────────────────────────────────── */}
      <nav className="border-b border-border bg-surface sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="font-mono font-bold text-text-primary tracking-tight text-lg">
            listlistlist
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
              className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-150"
            >
              Account
            </Link>
            {/* Live credit badge — client component */}
            <CreditBadge />
          </div>
        </div>
      </nav>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-10">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">Dashboard</h1>
            <p className="text-text-secondary text-sm mt-1">
              Your listings, credits, and account at a glance.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PlanBadge user={user} />
            <Link
              href="/generate"
              className="
                inline-flex items-center gap-2
                bg-accent hover:bg-accent-hover text-white font-semibold
                rounded-lg px-4 py-2.5 text-sm
                transition-colors duration-150
              "
            >
              <PlusIcon className="w-4 h-4" />
              New listing
            </Link>
          </div>
        </div>

        {/* ── Trial urgency banner ─────────────────────────────────────────── */}
        {user.subscription_status === 'trial' && daysLeft !== null && daysLeft <= 2 && (
          <div className="rounded-xl border border-warning bg-warning-muted px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-warning font-medium">
              {daysLeft === 0
                ? 'Your trial has expired — upgrade to keep generating listings.'
                : `Your trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. All your saved listings stay accessible after you upgrade.`}
            </p>
            <Link
              href="/pricing"
              className="
                flex-shrink-0 inline-flex items-center gap-1.5
                bg-warning hover:opacity-90 text-base font-semibold text-white
                px-4 py-2 rounded-lg text-sm transition-opacity duration-150
              "
            >
              <ZapIcon className="w-3.5 h-3.5" />
              Upgrade now
            </Link>
          </div>
        )}

        {/* ── Main grid ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column — listings (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-text-primary">Recent listings</h2>
              {(listings?.length ?? 0) > 0 && (
                <Link
                  href="/listings"
                  className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  View all →
                </Link>
              )}
            </div>

            {/* Listings grid — client component (handles load-more pagination) */}
            <ListingsGrid initialListings={listings ?? []} />
          </div>

          {/* Right column — sidebar (1/3 width) */}
          <div className="space-y-6">
            <CreditSummary user={user} />
            <BulkUploadPlaceholder plan={user.subscription_status} />
            <ReferralWidget />
          </div>
        </div>
      </div>
    </div>
  )
}
