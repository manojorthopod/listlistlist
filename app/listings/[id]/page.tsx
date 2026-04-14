import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, CalendarIcon, CoinsIcon } from 'lucide-react'
import { getListingById, getUserById } from '@/lib/db'
import { PLATFORM_META } from '@/lib/platforms'
import CreditBadge from '@/components/credit-badge'
import ListingViewer from '@/components/listing-viewer'
import type { ExtractedProduct, GeneratedListings, Platform } from '@/types'

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  try {
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

    const extractedData = coerceObject(listing.extracted_data) as ExtractedProduct | null
    const product = typeof extractedData?.product_type === 'string'
      ? extractedData.product_type
      : 'Listing'
    return { title: `${product} — listlistlist` }
  } catch (error) {
    console.error('[listings/[id]/page] metadata error:', error)
    return { title: 'Listing — listlistlist' }
  }
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

function ListingErrorState({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-8 text-center space-y-3">
      <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
      <p className="text-sm text-text-secondary">{message}</p>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-light transition-colors"
      >
        <ArrowLeftIcon className="w-3.5 h-3.5" />
        Back to dashboard
      </Link>
    </div>
  )
}

function isPlatform(value: unknown): value is Platform {
  return value === 'amazon'
    || value === 'etsy'
    || value === 'ebay'
    || value === 'shopify'
    || value === 'woocommerce'
    || value === 'tiktok'
}

function coerceObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== 'string') return null

  try {
    const parsed = JSON.parse(value) as unknown
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function coercePlatforms(value: unknown): Platform[] {
  if (Array.isArray(value)) return value.filter(isPlatform)
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter(isPlatform) : []
  } catch {
    return []
  }
}

function coerceGeneratedListings(value: unknown): GeneratedListings | null {
  const fromGeneratedListings = coerceObject(value)
  if (fromGeneratedListings) return fromGeneratedListings as GeneratedListings
  return null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  try {
    const { id } = await params

    const [listing, user] = await Promise.all([
      getListingById(id),
      getUserById(userId),
    ])

    if (!listing || listing.user_id !== userId) {
      return (
        <div className="min-h-screen bg-base">
          <div className="max-w-4xl mx-auto px-6 py-12">
            <ListingErrorState
              title="Listing not found"
              message="This listing does not exist, or you no longer have access to it."
            />
          </div>
        </div>
      )
    }

    if (!user) {
      return (
        <div className="min-h-screen bg-base">
          <div className="max-w-4xl mx-auto px-6 py-12">
            <ListingErrorState
              title="Account unavailable"
              message="We could not load your account details. Sign in again and retry."
            />
          </div>
        </div>
      )
    }

    const referralCode = userId.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase()
    const totalCredits = user.subscription_credits + user.topup_credits
    const date = new Date(listing.created_at).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })

    const platforms = coercePlatforms(listing.platforms)
    const generatedListings = coerceGeneratedListings(
      (listing as unknown as { generated_content?: unknown }).generated_content ?? listing.generated_listings
    )
    const extractedData = coerceObject(listing.extracted_data) as ExtractedProduct | null

    return (
      <div className="min-h-screen bg-base">

      {/* ── Navigation ───────────────────────────────────────────────────────── */}
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
                alt={(typeof extractedData?.product_type === 'string' ? extractedData.product_type : null) ?? 'Product'}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Meta */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-medium tracking-tight text-text-primary">
                {(typeof extractedData?.product_type === 'string' ? extractedData.product_type : null) ?? 'Product listing'}
              </h1>
              <StatusPill status={listing.status} />
            </div>

            {/* Extracted attributes */}
            {extractedData && (
              <div className="flex flex-wrap gap-2">
                {typeof extractedData.material === 'string' && extractedData.material.trim() && (
                  <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-xs text-text-secondary">
                    {extractedData.material}
                  </span>
                )}
                {typeof extractedData.color === 'string' && extractedData.color.trim() && (
                  <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-xs text-text-secondary">
                    {extractedData.color}
                  </span>
                )}
                {typeof extractedData.condition === 'string' && extractedData.condition.trim() && (
                  <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-xs text-text-secondary">
                    {extractedData.condition}
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
        {generatedListings && platforms.length > 0 ? (
          <ListingViewer
            listingId={listing.id}
            imageUrl={listing.image_url}
            extractedData={extractedData}
            platforms={platforms}
            initialListings={generatedListings}
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
  } catch (error) {
    console.error('[listings/[id]/page] render error:', error)

    return (
      <div className="min-h-screen bg-base">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <ListingErrorState
            title="Something went wrong"
            message="We could not load this listing right now. Please try again in a moment."
          />
        </div>
      </div>
    )
  }
}
