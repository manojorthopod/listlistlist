'use client'

import { useState, useCallback } from 'react'
import { UsersIcon, ZapIcon, RefreshCwIcon } from 'lucide-react'
import CopyButton from '@/components/copy-button'
import PlatformErrorState from '@/components/platform-error-state'
import { PLATFORM_META } from '@/lib/platforms'
import type {
  Platform,
  GeneratedListings,
  AmazonListing,
  EtsyListing,
  EbayListing,
  ShopifyListing,
  WooCommerceListing,
  TikTokListing,
  ExtractedProduct,
} from '@/types'

// ─── Shared field building blocks ─────────────────────────────────────────────

function FieldBlock({
  label,
  value,
  isHtml = false,
  mono   = true,
}: {
  label:   string
  value:   string | string[] | null | undefined
  isHtml?: boolean
  mono?:   boolean
}) {
  if (value == null) return null
  const display = Array.isArray(value) ? value.join('\n') : value
  if (!display.trim()) return null

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary uppercase tracking-widest font-medium">
          {label}
        </span>
        <CopyButton value={display} iconOnly />
      </div>
      {isHtml ? (
        <div
          className="bg-surface-2 border border-border rounded-lg p-4 text-sm text-text-primary
                     prose prose-invert max-w-none prose-sm"
          dangerouslySetInnerHTML={{ __html: value as string }}
        />
      ) : (
        <pre
          className={`
            bg-surface-2 border border-border rounded-lg p-4 text-sm text-text-primary
            whitespace-pre-wrap break-words leading-relaxed
            ${mono ? 'font-mono' : ''}
          `}
        >
          {display}
        </pre>
      )}
    </div>
  )
}

function TagList({ label, tags }: { label: string; tags: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary uppercase tracking-widest font-medium">
          {label}
        </span>
        <CopyButton value={tags.join(', ')} iconOnly />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="px-2 py-0.5 rounded bg-surface-2 border border-border text-xs text-text-secondary font-mono"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Per-platform output renderers ───────────────────────────────────────────

function AmazonOutput({ listing }: { listing: AmazonListing }) {
  const copyAll = [
    `TITLE\n${listing.title}`,
    `BULLETS\n${listing.bullets.join('\n')}`,
    `DESCRIPTION\n${listing.description}`,
    `SEARCH TERMS\n${listing.search_terms}`,
  ].join('\n\n')

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <CopyButton value={copyAll} label="Copy all" />
      </div>
      <FieldBlock label="Title"         value={listing.title} />
      <FieldBlock label="Bullet points" value={listing.bullets.join('\n\n')} />
      <FieldBlock label="Description"   value={listing.description} />
      <FieldBlock label="Search terms"  value={listing.search_terms} />
      <div className="flex items-start gap-2 rounded-lg border border-warning bg-warning-muted p-4 text-sm text-warning">
        <span className="text-base leading-none mt-0.5">⚠️</span>
        <p>
          <strong>Review before publishing.</strong> Amazon monitors AI-generated content and may
          flag listings with unverified specs or exaggerated claims. Ensure all dimensions and
          features are accurate before going live.
        </p>
      </div>
    </div>
  )
}

function EtsyOutput({ listing }: { listing: EtsyListing }) {
  const copyAll = [
    `TITLE\n${listing.title}`,
    `DESCRIPTION\n${listing.description}`,
    `TAGS\n${listing.tags.join(', ')}`,
  ].join('\n\n')

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <CopyButton value={copyAll} label="Copy all" />
      </div>
      <FieldBlock label="Title"       value={listing.title} />
      <FieldBlock label="Description" value={listing.description} />
      <TagList    label="Tags (13)"   tags={listing.tags} />
    </div>
  )
}

function EbayOutput({ listing }: { listing: EbayListing }) {
  const specificsText = Object.entries(listing.item_specifics)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

  const copyAll = [
    `TITLE\n${listing.title}`,
    `ITEM SPECIFICS\n${specificsText}`,
    `DESCRIPTION\n${listing.description}`,
    `PRICE GUIDANCE\n${listing.price_guidance}`,
    `CATEGORY\n${listing.category_suggestion}`,
  ].join('\n\n')

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <CopyButton value={copyAll} label="Copy all" />
      </div>
      <FieldBlock label="Title"          value={listing.title} />
      <FieldBlock label="Item specifics" value={specificsText} />
      <FieldBlock label="Description"    value={listing.description} />
      <FieldBlock label="Price guidance" value={listing.price_guidance} mono={false} />
      <FieldBlock label="Category"       value={listing.category_suggestion} mono={false} />
    </div>
  )
}

function ShopifyOutput({ listing }: { listing: ShopifyListing }) {
  const copyAll = [
    `TITLE\n${listing.title}`,
    `META DESCRIPTION\n${listing.meta_description}`,
    `ALT TEXT\n${listing.alt_text}`,
    `PRODUCT TYPE\n${listing.product_type}`,
    `TAGS\n${listing.tags}`,
  ].join('\n\n')

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <CopyButton value={copyAll} label="Copy all" />
      </div>
      <FieldBlock label="Title"            value={listing.title} />
      <FieldBlock label="Description HTML" value={listing.description_html} isHtml />
      <FieldBlock label="Meta description" value={listing.meta_description} mono={false} />
      <FieldBlock label="Image alt text"   value={listing.alt_text} />
      <FieldBlock label="Product type"     value={listing.product_type} mono={false} />
      <FieldBlock label="Tags"             value={listing.tags} mono={false} />
    </div>
  )
}

function WooCommerceOutput({ listing }: { listing: WooCommerceListing }) {
  const seoText = [
    `Focus keyword: ${listing.seo.focus_keyword}`,
    `SEO title: ${listing.seo.seo_title}`,
    `Meta description: ${listing.seo.meta_description}`,
  ].join('\n')

  const copyAll = [
    `PRODUCT NAME\n${listing.product_name}`,
    `SHORT DESCRIPTION\n${listing.short_description}`,
    `SKU\n${listing.sku_suggestion}`,
    `SEO\n${seoText}`,
  ].join('\n\n')

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <CopyButton value={copyAll} label="Copy all" />
      </div>
      <FieldBlock label="Product name"      value={listing.product_name} />
      <FieldBlock label="Short description" value={listing.short_description} mono={false} />
      <FieldBlock label="Full description"  value={listing.full_description_html} isHtml />
      <FieldBlock label="SKU suggestion"    value={listing.sku_suggestion} />
      {listing.weight_estimate && (
        <FieldBlock label="Weight estimate" value={listing.weight_estimate} />
      )}
      <FieldBlock label="SEO"               value={seoText} />
      <TagList    label="Tags"              tags={listing.tags} />
      <TagList    label="Image alt texts"   tags={listing.image_alt_texts} />
    </div>
  )
}

function TikTokOutput({ listing }: { listing: TikTokListing }) {
  const copyAll = [
    `TITLE\n${listing.title}`,
    `VIDEO HOOK\n${listing.short_video_hook}`,
    `DESCRIPTION\n${listing.description}`,
    `KEY SELLING POINTS\n${listing.key_selling_points.join('\n')}`,
    `HASHTAGS\n${listing.hashtags.join(' ')}`,
  ].join('\n\n')

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <CopyButton value={copyAll} label="Copy all" />
      </div>
      <FieldBlock label="Title"              value={listing.title} />
      <FieldBlock label="Short video hook"   value={listing.short_video_hook} />
      <FieldBlock label="Description"        value={listing.description} />
      <FieldBlock label="Key selling points" value={listing.key_selling_points.join('\n')} />
      <TagList    label="Hashtags"           tags={listing.hashtags} />
    </div>
  )
}

// ─── Regenerate button ────────────────────────────────────────────────────────

interface RegenerateButtonProps {
  platform:      Platform
  listingId:     string
  imageUrl:      string
  extractedData: ExtractedProduct
  totalCredits:  number
  onSuccess:     (platform: Platform, data: GeneratedListings[keyof GeneratedListings]) => void
}

function RegenerateButton({
  platform,
  listingId,
  imageUrl,
  extractedData,
  totalCredits,
  onSuccess,
}: RegenerateButtonProps) {
  const [status, setStatus] = useState<'idle' | 'confirming' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleRegenerate() {
    if (status === 'loading') return

    if (status !== 'confirming') {
      setStatus('confirming')
      return
    }

    setStatus('loading')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          imageHash:     '',        // hash not needed for regeneration
          extractedData,
          platforms:     [platform],
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus('error')
        setErrorMsg(data.error ?? 'Generation failed')
        return
      }

      const listing = (data.listings as Record<Platform, GeneratedListings[keyof GeneratedListings]>)[platform]

      if (!listing || data.failedPlatforms?.includes(platform)) {
        setStatus('error')
        setErrorMsg(data.errors?.[platform] ?? 'Generation failed')
        return
      }

      // Persist the updated platform data on the existing listing row
      await fetch(`/api/listings/${listingId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          generatedData:    listing,
          creditsUsedDelta: 1,
        }),
      })

      setStatus('idle')
      onSuccess(platform, listing)
    } catch {
      setStatus('error')
      setErrorMsg('Network error. Please try again.')
    }
  }

  if (status === 'confirming') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-secondary">
          This costs 1 credit. You have{' '}
          <span className="text-text-primary font-medium">{totalCredits}</span> remaining.
        </span>
        <button
          onClick={handleRegenerate}
          className="
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
            bg-accent hover:bg-accent-hover text-white transition-colors duration-150
          "
        >
          <RefreshCwIcon className="w-3.5 h-3.5" />
          Confirm
        </button>
        <button
          onClick={() => setStatus('idle')}
          className="
            px-3 py-1.5 rounded-lg text-sm font-medium border border-border hover:border-border-2
            bg-white text-text-secondary hover:text-text-primary transition-colors duration-150
          "
        >
          Cancel
        </button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-error">{errorMsg}</span>
        <button
          onClick={() => { setStatus('idle'); setErrorMsg(null) }}
          className="text-sm text-text-secondary hover:text-text-primary underline transition-colors"
        >
          Dismiss
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleRegenerate}
      disabled={status === 'loading'}
      className="
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
        border border-border hover:border-border-2 text-text-secondary
        hover:text-text-primary bg-white
        disabled:opacity-40 disabled:cursor-not-allowed
        transition-colors duration-150
      "
      style={status === 'loading' ? {} : {}}
    >
      {status === 'loading' ? (
        <>
          <span
            className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
            style={{ borderTopColor: 'transparent' }}
          />
          Regenerating…
        </>
      ) : (
        <>
          <RefreshCwIcon className="w-3.5 h-3.5" />
          Regenerate — 1 credit
        </>
      )}
    </button>
  )
}

// ─── Referral prompt ──────────────────────────────────────────────────────────

function ReferralPrompt({ referralCode }: { referralCode: string | null }) {
  if (!referralCode) return null
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://listlistlist.com'}/?ref=${referralCode}`

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-white p-5 shadow-card">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-accent-light flex items-center justify-center flex-shrink-0">
          <UsersIcon className="w-4 h-4 text-accent" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">Know another seller?</p>
          <p className="text-xs text-text-secondary mt-0.5">
            Share listlistlist and earn 20 free credits when they subscribe.
          </p>
        </div>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="
          flex-shrink-0 inline-flex items-center gap-1.5
          bg-accent hover:bg-accent-hover text-white
          px-4 py-2 rounded-lg text-sm font-medium
          transition-colors duration-150
        "
      >
        <ZapIcon className="w-3.5 h-3.5" />
        Share ListListList →
      </a>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface ListingViewerProps {
  listingId:      string
  imageUrl:       string
  extractedData:  ExtractedProduct | null
  platforms:      Platform[]
  initialListings: GeneratedListings
  referralCode:   string | null
  totalCredits:   number
}

export default function ListingViewer({
  listingId,
  imageUrl,
  extractedData,
  platforms,
  initialListings,
  referralCode,
  totalCredits,
}: ListingViewerProps) {
  const [activeTab,   setActiveTab]   = useState<Platform>(platforms[0])
  const [listings,    setListings]    = useState<GeneratedListings>(initialListings)
  const [errorTabs,   setErrorTabs]   = useState<Set<Platform>>(
    // Pre-mark any platform that has no data as errored
    () => new Set(
      platforms.filter((p) => !(initialListings as Record<Platform, unknown>)[p])
    )
  )

  const handleRegenSuccess = useCallback((
    platform: Platform,
    data:     GeneratedListings[keyof GeneratedListings]
  ) => {
    setListings((prev) => ({ ...prev, [platform]: data }))
    setErrorTabs((prev) => {
      const next = new Set(prev)
      next.delete(platform)
      return next
    })
  }, [])

  // If no extractedData, regenerate is unavailable (shouldn't happen for completed listings)
  const canRegenerate = extractedData !== null

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="bg-white border border-border rounded-lg flex overflow-x-auto">
        {platforms.map((p) => {
          const meta     = PLATFORM_META[p]
          const isActive = activeTab === p
          const hasError = errorTabs.has(p)
          const hasData  = !!(listings as Record<Platform, unknown>)[p]

          return (
            <button
              key={p}
              onClick={() => setActiveTab(p)}
              className={`
                relative flex items-center gap-2 px-4 py-3 text-sm font-medium
                whitespace-nowrap transition-colors duration-150 border-b-2 flex-shrink-0
                ${isActive
                  ? 'border-accent text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'}
              `}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: meta.color }}
              />
              {meta.label}
              {hasError && (
                <span className="w-1.5 h-1.5 rounded-full bg-error flex-shrink-0" />
              )}
              {!hasError && hasData && (
                <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="min-h-[200px]">
        {platforms.map((p) => {
          if (p !== activeTab) return null

          const platformData = (listings as Record<Platform, GeneratedListings[keyof GeneratedListings]>)[p]
          const hasError     = errorTabs.has(p)

          if (hasError || !platformData) {
            return (
              <div key={p} className="space-y-4">
                <PlatformErrorState
                  platform={p}
                  onRetry={() => {/* handled by RegenerateButton below */}}
                  isRetrying={false}
                />
                {canRegenerate && extractedData && (
                  <RegenerateButton
                    platform={p}
                    listingId={listingId}
                    imageUrl={imageUrl}
                    extractedData={extractedData}
                    totalCredits={totalCredits}
                    onSuccess={handleRegenSuccess}
                  />
                )}
              </div>
            )
          }

          return (
            <div key={p} className="space-y-6">
              {/* Regenerate button — always present for completed listings */}
              {canRegenerate && extractedData && (
                <div className="flex items-center justify-end">
                  <RegenerateButton
                    platform={p}
                    listingId={listingId}
                    imageUrl={imageUrl}
                    extractedData={extractedData}
                    totalCredits={totalCredits}
                    onSuccess={handleRegenSuccess}
                  />
                </div>
              )}

              {p === 'amazon'      && <AmazonOutput      listing={platformData as AmazonListing} />}
              {p === 'etsy'        && <EtsyOutput        listing={platformData as EtsyListing} />}
              {p === 'ebay'        && <EbayOutput        listing={platformData as EbayListing} />}
              {p === 'shopify'     && <ShopifyOutput     listing={platformData as ShopifyListing} />}
              {p === 'woocommerce' && <WooCommerceOutput listing={platformData as WooCommerceListing} />}
              {p === 'tiktok'      && <TikTokOutput      listing={platformData as TikTokListing} />}
            </div>
          )
        })}
      </div>

      {/* Post-generation referral prompt */}
      <ReferralPrompt referralCode={referralCode} />
    </div>
  )
}
