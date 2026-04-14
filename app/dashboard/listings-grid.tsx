'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { ZapIcon, AlertCircleIcon, CheckCircleIcon, ClockIcon } from 'lucide-react'
import { PLATFORM_META } from '@/lib/platforms'
import type { Listing, Platform, ListingStatus } from '@/types'

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ListingStatus }) {
  const config: Record<ListingStatus, { label: string; className: string; Icon: React.ElementType }> = {
    completed:  { label: 'Complete',   className: 'text-success bg-success-muted border-success',     Icon: CheckCircleIcon },
    generating: { label: 'Generating', className: 'text-accent bg-accent-muted border-accent',        Icon: ZapIcon },
    failed:     { label: 'Failed',     className: 'text-error bg-error-muted border-error',           Icon: AlertCircleIcon },
    pending:    { label: 'Pending',    className: 'text-text-secondary bg-surface-2 border-border',   Icon: ClockIcon },
    confirming: { label: 'Confirming', className: 'text-text-secondary bg-surface-2 border-border',   Icon: ClockIcon },
  }
  const { label, className, Icon } = config[status] ?? config.pending

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium
        ${className}
      `}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}

// ─── Platform dots ────────────────────────────────────────────────────────────

function PlatformDots({ platforms }: { platforms: Platform[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {platforms.map((p) => (
        <span
          key={p}
          title={PLATFORM_META[p]?.label ?? p}
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: PLATFORM_META[p]?.color ?? '#888' }}
        />
      ))}
      <span className="text-xs text-text-disabled ml-0.5">
        {platforms.map((p) => PLATFORM_META[p]?.label ?? p).join(', ')}
      </span>
    </div>
  )
}

// ─── Single listing card ──────────────────────────────────────────────────────

function ListingCard({ listing }: { listing: Listing }) {
  const date = new Date(listing.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  const productType = listing.extracted_data?.product_type ?? 'Product'

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="
        group flex items-start gap-4
        bg-white border border-border rounded-xl p-4 shadow-card
        hover:shadow-card-hover hover:border-border-2 transition-all duration-150
      "
    >
      {/* Thumbnail */}
      <div className="w-16 h-16 rounded-lg overflow-hidden bg-surface-2 border border-border flex-shrink-0">
        {listing.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.image_url}
            alt={productType}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-disabled text-xs">
            No image
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-text-primary truncate">
            {productType}
          </p>
          <StatusBadge status={listing.status} />
        </div>

        <PlatformDots platforms={listing.platforms} />

        <div className="flex items-center justify-between gap-2 text-xs text-text-disabled">
          <span>{date}</span>
          {listing.credits_used > 0 && (
            <span>{listing.credits_used} credit{listing.credits_used !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-xl border border-border bg-white shadow-card text-center">
      <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center">
        <ZapIcon className="w-5 h-5 text-accent" />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary">No listings yet</p>
        <p className="text-xs text-text-secondary mt-1">
          Upload a product photo to generate your first listing.
        </p>
      </div>
      <Link
        href="/generate"
        className="
          bg-accent hover:bg-accent-hover text-white font-medium
          rounded-lg px-4 py-2 text-sm transition-colors duration-150
        "
      >
        Generate first listing
      </Link>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ListingsGridProps {
  initialListings: Listing[]
}

const PAGE_SIZE = 10

export default function ListingsGrid({ initialListings }: ListingsGridProps) {
  const [listings,    setListings]    = useState<Listing[]>(initialListings)
  const [page,        setPage]        = useState(0)
  const [hasMore,     setHasMore]     = useState(initialListings.length === PAGE_SIZE)
  const [loading,     setLoading]     = useState(false)

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    const nextPage = page + 1
    setLoading(true)
    try {
      const res  = await fetch(`/api/listings?page=${nextPage}&pageSize=${PAGE_SIZE}`)
      const data = await res.json()
      const newListings: Listing[] = data.listings ?? []
      setListings((prev) => [...prev, ...newListings])
      setPage(nextPage)
      setHasMore(newListings.length === PAGE_SIZE)
    } catch {
      // Fail silently — keep existing listings
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, page])

  if (listings.length === 0) return <EmptyState />

  return (
    <div className="space-y-3">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}

      {/* Load more */}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="
            w-full py-3 text-sm font-medium text-text-secondary
            hover:text-text-primary border border-border hover:border-border-2
            rounded-xl bg-white transition-colors duration-150
            disabled:opacity-40 disabled:cursor-not-allowed
          "
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              Loading…
            </span>
          ) : (
            'Load more'
          )}
        </button>
      )}
    </div>
  )
}
