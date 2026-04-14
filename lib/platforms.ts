import type { Platform } from '@/types'

export interface PlatformMeta {
  id: Platform
  label: string
  description: string
  color: string
  hoverBorder: string
  hoverShadow: string
  activeBg: string
}

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  amazon: {
    id: 'amazon',
    label: 'Amazon',
    description: 'Keyword-rich copy optimised for search ranking and conversion',
    color: '#FF9900',
    hoverBorder: 'hover:border-[#FF9900]/60',
    hoverShadow: 'hover:shadow-[0_0_20px_#FF990015]',
    activeBg: 'bg-[#FF9900]/10 border-[#FF9900]',
  },
  etsy: {
    id: 'etsy',
    label: 'Etsy',
    description: 'Story-driven listings with 13 searchable tags for discovery',
    color: '#F1641E',
    hoverBorder: 'hover:border-[#F1641E]/60',
    hoverShadow: 'hover:shadow-[0_0_20px_#F1641E15]',
    activeBg: 'bg-[#F1641E]/10 border-[#F1641E]',
  },
  ebay: {
    id: 'ebay',
    label: 'eBay',
    description: 'Condition-clear, factual listings for value-focused buyers',
    color: '#E53238',
    hoverBorder: 'hover:border-[#E53238]/60',
    hoverShadow: 'hover:shadow-[0_0_20px_#E5323815]',
    activeBg: 'bg-[#E53238]/10 border-[#E53238]',
  },
  shopify: {
    id: 'shopify',
    label: 'Shopify',
    description: 'Brand-voice HTML copy optimised for Google Shopping',
    color: '#96BF48',
    hoverBorder: 'hover:border-[#96BF48]/60',
    hoverShadow: 'hover:shadow-[0_0_20px_#96BF4815]',
    activeBg: 'bg-[#96BF48]/10 border-[#96BF48]',
  },
  woocommerce: {
    id: 'woocommerce',
    label: 'WooCommerce',
    description: 'Yoast/Rank Math SEO-optimised listings with full HTML control',
    color: '#7F54B3',
    hoverBorder: 'hover:border-[#7F54B3]/60',
    hoverShadow: 'hover:shadow-[0_0_20px_#7F54B315]',
    activeBg: 'bg-[#7F54B3]/10 border-[#7F54B3]',
  },
  tiktok: {
    id: 'tiktok',
    label: 'TikTok Shop',
    description: 'Hook-first copy with hashtags and a short video hook line',
    color: '#FF004F',
    hoverBorder: 'hover:border-[#FF004F]/60',
    hoverShadow: 'hover:shadow-[0_0_20px_#FF004F15]',
    activeBg: 'bg-[#FF004F]/10 border-[#FF004F]',
  },
}
