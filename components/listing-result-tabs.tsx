'use client'

import { useState } from 'react'
import { UsersIcon, ZapIcon } from 'lucide-react'
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
} from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformState {
  status:  'loading' | 'success' | 'error'
  listing: GeneratedListings[keyof GeneratedListings]
  error?:  string
}

export type PlatformStateMap = Partial<Record<Platform, PlatformState>>

interface ListingResultTabsProps {
  platforms:    Platform[]
  platformState: PlatformStateMap
  referralCode: string | null
  subscriptionCredits: number
  topupCredits: number
  onRetry:      (platform: Platform) => void
  retryingPlatforms: Set<Platform>
}

// ─── Output field block ───────────────────────────────────────────────────────

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
  const display = tags.join(', ')
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary uppercase tracking-widest font-medium">
          {label}
        </span>
        <CopyButton value={display} iconOnly />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
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

      <FieldBlock label="Title"        value={listing.title} />
      <FieldBlock label="Bullet points" value={listing.bullets.join('\n\n')} />
      <FieldBlock label="Description"  value={listing.description} />
      <FieldBlock label="Search terms" value={listing.search_terms} />

      {/* Mandatory Amazon AI warning */}
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
      <FieldBlock label="Title"           value={listing.title} />
      <FieldBlock label="Item specifics"  value={specificsText} />
      <FieldBlock label="Description"     value={listing.description} />
      <FieldBlock label="Price guidance"  value={listing.price_guidance} mono={false} />
      <FieldBlock label="Category"        value={listing.category_suggestion} mono={false} />
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
      <FieldBlock label="Product name"       value={listing.product_name} />
      <FieldBlock label="Short description"  value={listing.short_description} mono={false} />
      <FieldBlock label="Full description"   value={listing.full_description_html} isHtml />
      <FieldBlock label="SKU suggestion"     value={listing.sku_suggestion} />
      {listing.weight_estimate && (
        <FieldBlock label="Weight estimate" value={listing.weight_estimate} />
      )}
      <FieldBlock label="SEO"                value={seoText} />
      <TagList    label="Tags"               tags={listing.tags} />
      <TagList    label="Image alt texts"    tags={listing.image_alt_texts} />
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

// ─── Spinner ──────────────────────────────────────────────────────────────────

function PlatformSpinner({ color }: { color: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div
        className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: `${color}40`, borderTopColor: 'transparent' }}
      >
        <span className="sr-only">Generating…</span>
      </div>
      <p className="text-sm text-text-secondary">Generating listing…</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ListingResultTabs({
  platforms,
  platformState,
  referralCode,
  subscriptionCredits,
  topupCredits,
  onRetry,
  retryingPlatforms,
}: ListingResultTabsProps) {
  const [activeTab, setActiveTab] = useState<Platform>(platforms[0])

  const referralUrl = referralCode
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://listlistlist.com'}/?ref=${referralCode}`
    : null

  return (
    <div className="space-y-6">
      {/* Credit balance */}
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <span className="inline-block w-2 h-2 rounded-full bg-accent" />
        <span>
          <span className="text-text-primary font-medium">{subscriptionCredits}</span> monthly credits
        </span>
        {topupCredits > 0 && (
          <>
            <span className="text-border-2">·</span>
            <span className="inline-block w-2 h-2 rounded-full bg-text-secondary" />
            <span>
              <span className="text-text-primary font-medium">{topupCredits}</span> top-up credits
            </span>
          </>
        )}
      </div>

      {/* Tab bar */}
      <div className="bg-white border border-border rounded-lg flex gap-0 overflow-x-auto">
        {platforms.map((p) => {
          const meta  = PLATFORM_META[p]
          const state = platformState[p]
          const isActive = activeTab === p

          return (
            <button
              key={p}
              onClick={() => setActiveTab(p)}
              className={`
                relative flex items-center gap-2 px-4 py-3 text-sm font-medium
                whitespace-nowrap transition-colors duration-150 border-b-2
                ${isActive
                  ? 'border-accent text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'}
              `}
            >
              {/* Platform colour dot */}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: meta.color }}
              />
              {meta.label}

              {/* Status indicator */}
              {state?.status === 'loading' && (
                <span
                  className="w-3 h-3 rounded-full border border-t-transparent animate-spin flex-shrink-0"
                  style={{ borderColor: `${meta.color}60`, borderTopColor: 'transparent' }}
                />
              )}
              {state?.status === 'error' && (
                <span className="w-1.5 h-1.5 rounded-full bg-error flex-shrink-0" />
              )}
              {state?.status === 'success' && (
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
          const state = platformState[p]
          const meta  = PLATFORM_META[p]

          if (!state || state.status === 'loading') {
            return <PlatformSpinner key={p} color={meta.color} />
          }

          if (state.status === 'error') {
            return (
              <PlatformErrorState
                key={p}
                platform={p}
                onRetry={() => onRetry(p)}
                isRetrying={retryingPlatforms.has(p)}
              />
            )
          }

          if (!state.listing) {
            return (
              <PlatformErrorState
                key={p}
                platform={p}
                onRetry={() => onRetry(p)}
                isRetrying={retryingPlatforms.has(p)}
              />
            )
          }

          return (
            <div key={p}>
              {p === 'amazon'      && <AmazonOutput      listing={state.listing as AmazonListing} />}
              {p === 'etsy'        && <EtsyOutput        listing={state.listing as EtsyListing} />}
              {p === 'ebay'        && <EbayOutput        listing={state.listing as EbayListing} />}
              {p === 'shopify'     && <ShopifyOutput     listing={state.listing as ShopifyListing} />}
              {p === 'woocommerce' && <WooCommerceOutput listing={state.listing as WooCommerceListing} />}
              {p === 'tiktok'      && <TikTokOutput      listing={state.listing as TikTokListing} />}
            </div>
          )
        })}
      </div>

      {/* Post-generation referral prompt */}
      {referralUrl && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-white p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent-light flex items-center justify-center flex-shrink-0">
              <UsersIcon className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Your listings are ready!
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                Know another seller who&apos;d love this? Share listlistlist and earn 10 free credits →
              </p>
            </div>
          </div>
          <a
            href={referralUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="
              self-start sm:self-auto flex-shrink-0 inline-flex items-center gap-1.5
              bg-accent hover:bg-accent-hover text-white
              px-4 py-2 rounded-lg text-sm font-medium
              transition-colors duration-150
            "
          >
            <ZapIcon className="w-3.5 h-3.5" />
            Share
          </a>
        </div>
      )}
    </div>
  )
}
