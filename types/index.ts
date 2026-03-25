// ─── Platform ────────────────────────────────────────────────────────────────

export type Platform =
  | 'amazon'
  | 'etsy'
  | 'ebay'
  | 'shopify'
  | 'woocommerce'
  | 'tiktok'

export const ALL_PLATFORMS: Platform[] = [
  'amazon',
  'etsy',
  'ebay',
  'shopify',
  'woocommerce',
  'tiktok',
]

// ─── User ─────────────────────────────────────────────────────────────────────

export type SubscriptionStatus = 'trial' | 'starter' | 'pro' | 'cancelled'
export type BillingInterval = 'monthly' | 'annual'

export interface User {
  id: string
  email: string
  stripe_customer_id: string | null
  subscription_status: SubscriptionStatus
  billing_interval: BillingInterval
  subscription_credits: number
  topup_credits: number
  preferred_platforms: Platform[]
  brand_voice: string | null
  trial_started_at: string | null
  credits_reset_at: string | null
  onboarding_email_sent: boolean
  referral_code: string | null
  created_at: string
}

// ─── Extracted Product ────────────────────────────────────────────────────────

export interface ExtractedProduct {
  product_type: string
  material: string | null
  color: string | null
  dimensions: string | null
  style: string | null
  key_features: string[]
  condition: 'New' | 'Used' | 'Handmade' | 'Vintage'
  suggested_category: string | null
  // User-added fields on the confirmation screen
  target_audience?: string | null
  brand_voice?: string | null
  /** When true, the confirmation form surfaces a prompt to enter name and details manually */
  extraction_incomplete?: boolean
  manual_entry_hint?: string | null
}

// ─── Generated Listings ───────────────────────────────────────────────────────

export interface AmazonListing {
  title: string
  bullets: string[]
  description: string
  search_terms: string
}

export interface EtsyListing {
  title: string
  description: string
  tags: string[]
}

export interface EbayListing {
  title: string
  item_specifics: {
    Condition: string
    Brand: string
    Material: string | null
    Color: string | null
    Size: string | null
  }
  description: string
  price_guidance: string
  category_suggestion: string
}

export interface ShopifyListing {
  title: string
  description_html: string
  meta_description: string
  alt_text: string
  product_type: string
  tags: string
}

export interface WooCommerceListing {
  product_name: string
  short_description: string
  full_description_html: string
  sku_suggestion: string
  weight_estimate: string | null
  dimensions: string | null
  categories: string[]
  tags: string[]
  seo: {
    focus_keyword: string
    seo_title: string
    meta_description: string
  }
  image_alt_texts: string[]
}

export interface TikTokListing {
  title: string
  description: string
  hashtags: string[]
  short_video_hook: string
  key_selling_points: string[]
}

export type PlatformListing =
  | AmazonListing
  | EtsyListing
  | EbayListing
  | ShopifyListing
  | WooCommerceListing
  | TikTokListing

export type GeneratedListings = {
  amazon?: AmazonListing | null
  etsy?: EtsyListing | null
  ebay?: EbayListing | null
  shopify?: ShopifyListing | null
  woocommerce?: WooCommerceListing | null
  tiktok?: TikTokListing | null
}

// ─── Listing (DB row) ─────────────────────────────────────────────────────────

export type ListingStatus =
  | 'pending'
  | 'confirming'
  | 'generating'
  | 'completed'
  | 'failed'

export interface Listing {
  id: string
  user_id: string
  image_url: string
  image_hash: string
  extracted_data: ExtractedProduct | null
  platforms: Platform[]
  generated_listings: GeneratedListings | null
  prompt_version: string
  status: ListingStatus
  credits_used: number
  created_at: string
}

// ─── Top-up Packs ─────────────────────────────────────────────────────────────

export type TopupPackId = 'starter_pack' | 'growth_pack' | 'scale_pack'

export interface TopupPack {
  id: TopupPackId
  name: string
  credits: number
  price_gbp: number
  price_per_credit: number
}

export const TOPUP_PACKS: TopupPack[] = [
  { id: 'starter_pack', name: 'Starter pack', credits: 100, price_gbp: 14, price_per_credit: 0.14 },
  { id: 'growth_pack',  name: 'Growth pack',  credits: 300, price_gbp: 35, price_per_credit: 0.12 },
  { id: 'scale_pack',   name: 'Scale pack',   credits: 700, price_gbp: 70, price_per_credit: 0.10 },
]

// ─── Topup Purchase (DB row) ──────────────────────────────────────────────────

export interface TopupPurchase {
  id: string
  user_id: string
  stripe_payment_intent_id: string
  pack_name: TopupPackId
  credits_purchased: number
  amount_paid: number
  created_at: string
}

// ─── Referral (DB row) ────────────────────────────────────────────────────────

export interface Referral {
  id: string
  referrer_user_id: string
  referred_user_id: string
  credits_awarded: boolean
  created_at: string
}

// ─── Email types ──────────────────────────────────────────────────────────────

export type EmailType =
  | 'welcome'
  | 'day2_tip'
  | 'day5_trial_nudge'
  | 'day7_trial_expiry'
  | 'credits_low'

export interface EmailLog {
  id: string
  user_id: string
  email_type: EmailType
  sent_at: string
}

// ─── API response types ───────────────────────────────────────────────────────

export interface CreditBalance {
  subscriptionCredits: number
  topupCredits: number
  totalCredits: number
  plan: SubscriptionStatus
  billingInterval: BillingInterval
  creditsResetAt: string | null
  rolloverCap: number
}

export interface GenerateResponse {
  listings: GeneratedListings
  failedPlatforms: Platform[]
  errors: Partial<Record<Platform, string>>
  subscriptionCreditsRemaining: number
  topupCreditsRemaining: number
}

// ─── Validated output ─────────────────────────────────────────────────────────

export interface ValidatedOutput {
  platform: Platform
  data: PlatformListing
  truncatedFields: string[]
  strippedFields: string[]
}

// ─── Plan constants ───────────────────────────────────────────────────────────

export const PLAN_MONTHLY_CREDITS: Record<SubscriptionStatus, number> = {
  trial:     10,
  starter:   50,
  pro:       1000,
  cancelled: 0,
}

export const PLAN_ROLLOVER_CAP: Record<SubscriptionStatus, number> = {
  trial:     10,
  starter:   100,
  pro:       2000,
  cancelled: 0,
}
