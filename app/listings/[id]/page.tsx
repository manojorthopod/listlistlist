import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, CalendarIcon, CoinsIcon } from 'lucide-react'
import { getListingById, getUserById } from '@/lib/db'
import { PLATFORM_META } from '@/components/platform-toggle-card'
import CreditBadge from '@/components/credit-badge'
import ListingViewer from '@/components/listing-viewer'
import type { Platform } from '@/types'

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Always verify ownership before embedding any listing data in the <title>.
  // Without this check, anyone who guesses a UUID could discover the product
  // type of another user's listing from the HTML <title> tag.
  const { userId } = await auth()
  if (!userId) return { title: 'Listing — listlistlist' }

  const { id } = await params
  const listing = await getListingById(id)

  // Return a generic title for listings that don't belong to this user —
  // treat forbidden the same as not-found to avoid information leakage.
  if (!listing || listing.user_id !== userId) return { title: 'Listing — listlistlist' }

  const product = listing.extracted_data?.product_type ?? 'Listing'
  return { title: `${product} — listlistlist` }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed:  'bg-success-muted border-success text-success',
    generating: 'bg-accent-muted border-accent text-accent',
    failed:     'bg-error-muted border-error text-error',
    pending:    'bg-surface-2 border-border text-text-secondary',
    confirming: 'bg-surface-2 border-border text-text-secondary',
  }
  return (
    <span
      className={`
        text-xs font-semibold px-2.5 py-1 rounded-full border
        ${map[status] ?? map.pending}
      `}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { id } = await params

  const [listing, user] = await Promise.all([
    getListingById(id),
    getUserById(userId),
  ])

  if (!listing)                     notFound()
  if (listing.user_id !== userId)   notFound()  // treat forbidden as not-found
  if (!user)                        redirect('/sign-in')

  const referralCode = userId.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase()
  const totalCredits = user.subscription_credits + user.topup_credits
  const date = new Date(listing.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // Build the platform list — only platforms that were requested
  const platforms = listing.platforms as Platform[]

  return (
    <div className="min-h-screen bg-base">

      {/* ── Navigation ───────────────────────────────────────────────────────── */}
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
            <CreditBadge />
          </div>
        </div>
      </nav>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">

        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors duration-150"
        >
          <ArrowLeftIcon className="w-3.5 h-3.5" />
          Back to dashboard
        </Link>

        {/* ── Listing header ──────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">

          {/* Product thumbnail */}
          {listing.image_url && (
            <div className="w-24 h-24 rounded-xl overflow-hidden border border-border bg-surface-2 flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={listing.image_url}
                alt={listing.extracted_data?.product_type ?? 'Product'}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Meta */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                {listing.extracted_data?.product_type ?? 'Product listing'}
              </h1>
              <StatusPill status={listing.status} />
            </div>

            {/* Extracted attributes */}
            {listing.extracted_data && (
              <div className="flex flex-wrap gap-2">
                {listing.extracted_data.material && (
                  <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-xs text-text-secondary">
                    {listing.extracted_data.material}
                  </span>
                )}
                {listing.extracted_data.color && (
                  <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-xs text-text-secondary">
                    {listing.extracted_data.color}
                  </span>
                )}
                {listing.extracted_data.condition && (
                  <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-xs text-text-secondary">
                    {listing.extracted_data.condition}
                  </span>
                )}
              </div>
            )}

            {/* Date, platforms, credits */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-text-disabled">
              <span className="flex items-center gap-1">
                <CalendarIcon className="w-3 h-3" />
                {date}
              </span>
              <span className="flex items-center gap-1">
                <CoinsIcon className="w-3 h-3" />
                {listing.credits_used} credit{listing.credits_used !== 1 ? 's' : ''} used
              </span>
              {/* Platform colour dots */}
              <span className="flex items-center gap-1">
                {platforms.map((p) => (
                  <span
                    key={p}
                    title={PLATFORM_META[p]?.label}
                    className="w-2 h-2 rounded-full"
                    style={{ background: PLATFORM_META[p]?.color ?? '#888' }}
                  />
                ))}
                <span className="ml-0.5">
                  {platforms.map((p) => PLATFORM_META[p]?.label ?? p).join(', ')}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* ── Listing content ─────────────────────────────────────────────── */}
        {listing.generated_listings && platforms.length > 0 ? (
          <ListingViewer
            listingId={listing.id}
            imageUrl={listing.image_url}
            extractedData={listing.extracted_data}
            platforms={platforms}
            initialListings={listing.generated_listings}
            referralCode={referralCode}
            totalCredits={totalCredits}
          />
        ) : (
          <div className="rounded-xl border border-border bg-surface p-8 text-center space-y-3">
            <p className="text-text-secondary text-sm">
              {listing.status === 'generating'
                ? 'This listing is still being generated. Refresh the page in a moment.'
                : listing.status === 'failed'
                  ? 'Generation failed for this listing. Return to the dashboard and try again.'
                  : 'No generated content found for this listing.'}
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-light transition-colors"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" />
              Back to dashboard
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
