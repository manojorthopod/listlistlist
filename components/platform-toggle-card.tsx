'use client'

import type { Platform } from '@/types'

// ─── Platform metadata ────────────────────────────────────────────────────────

export const PLATFORM_META: Record<
  Platform,
  { label: string; description: string; color: string; hoverBorder: string; hoverShadow: string; activeBg: string }
> = {
  amazon: {
    label:       'Amazon',
    description: 'Keyword-rich copy optimised for search ranking and conversion',
    color:       '#FF9900',
    hoverBorder: 'hover:border-[#FF9900]/60',
    hoverShadow: 'hover:shadow-[0_0_20px_#FF990015]',
    activeBg:    'bg-[#FF9900]/10 border-[#FF9900]',
  },
  etsy: {
    label:       'Etsy',
    description: 'Story-driven listings with 13 searchable tags for discovery',
    color:       '#F1641E',
    hoverBorder: 'hover:border-[#F1641E]/60',
    hoverShadow: 'hover:shadow-[0_0_20px_#F1641E15]',
    activeBg:    'bg-[#F1641E]/10 border-[#F1641E]',
  },
  ebay: {
    label:       'eBay',
    description: 'Condition-clear, factual listings for value-focused buyers',
    color:       '#E53238',
    hoverBorder: 'hover:border-[#E53238]/60',
    hoverShadow: 'hover:shadow-[0_0_20px_#E5323815]',
    activeBg:    'bg-[#E53238]/10 border-[#E53238]',
  },
  shopify: {
    label:       'Shopify',
    description: 'Brand-voice HTML copy optimised for Google Shopping',
    color:       '#96BF48',
    hoverBorder: 'hover:border-[#96BF48]/60',
    hoverShadow: 'hover:shadow-[0_0_20px_#96BF4815]',
    activeBg:    'bg-[#96BF48]/10 border-[#96BF48]',
  },
  woocommerce: {
    label:       'WooCommerce',
    description: 'Yoast/Rank Math SEO-optimised listings with full HTML control',
    color:       '#7F54B3',
    hoverBorder: 'hover:border-[#7F54B3]/60',
    hoverShadow: 'hover:shadow-[0_0_20px_#7F54B315]',
    activeBg:    'bg-[#7F54B3]/10 border-[#7F54B3]',
  },
  tiktok: {
    label:       'TikTok Shop',
    description: 'Hook-first copy with hashtags and a short video hook line',
    color:       '#FF004F',
    hoverBorder: 'hover:border-[#FF004F]/60',
    hoverShadow: 'hover:shadow-[0_0_20px_#FF004F15]',
    activeBg:    'bg-[#FF004F]/10 border-[#FF004F]',
  },
}

// ─── Platform logo SVGs ───────────────────────────────────────────────────────

function PlatformIcon({ platform, size = 24 }: { platform: Platform; size?: number }) {
  const color = PLATFORM_META[platform].color

  if (platform === 'tiktok') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="TikTok">
        <path
          d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.19 8.19 0 004.79 1.53V6.75a4.85 4.85 0 01-1.02-.06z"
          fill={color}
        />
      </svg>
    )
  }

  // Generic coloured circle with initial — sufficient for an off-platform context
  const initials: Record<Platform, string> = {
    amazon:      'A',
    etsy:        'E',
    ebay:        'e',
    shopify:     'S',
    woocommerce: 'W',
    tiktok:      'T',
  }

  return (
    <div
      style={{ width: size, height: size, background: color, fontSize: size * 0.45 }}
      className="rounded-md flex items-center justify-center text-white font-bold select-none"
    >
      {initials[platform]}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PlatformToggleCardProps {
  platform:  Platform
  selected:  boolean
  onToggle:  (platform: Platform) => void
}

export default function PlatformToggleCard({
  platform,
  selected,
  onToggle,
}: PlatformToggleCardProps) {
  const meta = PLATFORM_META[platform]

  return (
    <button
      type="button"
      onClick={() => onToggle(platform)}
      className={`
        relative w-full text-left p-4 rounded-xl border shadow-card
        transition-all duration-150 cursor-pointer
        ${selected
          ? meta.activeBg
          : `bg-white border-border ${meta.hoverBorder} hover:shadow-card-hover`}
      `}
    >
      <div className="flex items-start gap-3">
        <PlatformIcon platform={platform} size={28} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-text-primary">{meta.label}</span>
            {/* Checkbox */}
            <div
              className={`
                w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center
                transition-colors duration-150
                ${selected ? 'border-0' : 'border-border bg-surface-2'}
              `}
              style={selected ? { background: meta.color } : {}}
            >
              {selected && (
                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
          <p className="text-xs text-text-secondary mt-0.5 leading-snug">{meta.description}</p>
        </div>
      </div>
    </button>
  )
}
