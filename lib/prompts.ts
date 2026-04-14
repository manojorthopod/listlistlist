import type { Platform, ExtractedProduct } from '@/types'

/**
 * Increment this string when prompt copy changes significantly.
 * Stored on every listing row so output quality can be tracked over time.
 */
export const PROMPT_VERSION = 'v1.0'

// ─── Shared system prompt ─────────────────────────────────────────────────────

export const GENERATION_SYSTEM_PROMPT = `You are an expert e-commerce copywriter specialising in platform-specific product listings. You write listings that rank well and convert browsers into buyers. Follow the exact structure and character limits specified. Return only valid JSON. Do not use markdown formatting in any field — all text must be plain and copy-paste ready.`

const UNIQUENESS_INSTRUCTION = `Important: Generate completely original copy. Do not use generic phrases like 'perfect for', 'great condition', 'don't miss out'. Write as if this is the only listing of its kind. Vary sentence structure, lead with different angles (condition, use case, rarity, value), and avoid clichéd listing language.`

// ─── Platform user prompts ────────────────────────────────────────────────────

function dataBlock(extracted: ExtractedProduct): string {
  return JSON.stringify(extracted, null, 2)
}

function voiceLine(brandVoice: string | null | undefined): string {
  return brandVoice ? `Brand voice: ${brandVoice}` : 'Brand voice: professional and clear'
}

export function buildAmazonPrompt(extracted: ExtractedProduct, generationId: string): string {
  return `Create an Amazon product listing. Prioritise keyword-rich, factual language. No promotional claims (best, #1, amazing, etc.). Amazon uses AI detection to monitor listings — never fabricate specs, dimensions, or claims that cannot be verified from the product data provided.

${UNIQUENESS_INSTRUCTION}
Generation ID: ${generationId}

Product data:
${dataBlock(extracted)}
${voiceLine(extracted.brand_voice)}

Return ONLY valid JSON with no commentary:
{
  "title": "max 200 chars — Brand + Product Type + Material + Color + Key Feature. No ALL CAPS. No promotional language.",
  "bullets": [
    "Bullet 1: Lead with primary customer benefit + the feature delivering it",
    "Bullet 2: Material quality and what it means for durability or feel",
    "Bullet 3: Specific use case or scenario where this product shines",
    "Bullet 4: Dimensions/specs — omit entirely if not confirmed, never fabricate",
    "Bullet 5: Gift potential or care instructions"
  ],
  "description": "max 2000 chars — opening sentence with primary keyword, 2-3 paragraphs, natural keyword integration, What's in the box section",
  "search_terms": "max 250 bytes — space-separated backend keywords, synonyms, alternate spellings. No brand names, no ASINs, no repetition"
}`
}

export function buildEtsyPrompt(extracted: ExtractedProduct, generationId: string): string {
  return `Create an Etsy product listing. Etsy buyers respond to story, craft, and occasion. Lead with emotion and discovery.

${UNIQUENESS_INSTRUCTION}
Generation ID: ${generationId}

Product data:
${dataBlock(extracted)}
${voiceLine(extracted.brand_voice)}

Return ONLY valid JSON with no commentary:
{
  "title": "max 140 chars — what it is + material + occasion or recipient + one emotional hook. No generic filler words.",
  "description": "Structure: (1) Opening hook paragraph. (2) 'Why You'll Love It' section. (3) 'Materials & Dimensions' section — omit dimensions if unconfirmed. (4) 'Perfect As A Gift For' section. (5) Shipping/personalisation note. (6) Closing CTA.",
  "tags": ["13 tags, max 20 chars each — mix of product type, material, occasion, style, recipient type, season. No single generic words."]
}`
}

export function buildEbayPrompt(extracted: ExtractedProduct, generationId: string): string {
  return `Create an eBay product listing. eBay buyers are value-conscious and detail-oriented. Modern eBay search penalises keyword stuffing — write clean, factual listings. Do NOT use ALL CAPS or power words like RARE or FAST SHIPPING in titles.

${UNIQUENESS_INSTRUCTION}
Generation ID: ${generationId}

Product data:
${dataBlock(extracted)}
${voiceLine(extracted.brand_voice)}

Return ONLY valid JSON with no commentary:
{
  "title": "max 80 chars — Brand (if known) + Product Name + Key Descriptor + Condition. Clean sentence case.",
  "item_specifics": {
    "Condition": "New / Used / For parts",
    "Brand": "extracted or Unbranded",
    "Material": "extracted or null",
    "Color": "extracted or null",
    "Size": "extracted or See description"
  },
  "description": "Structure: (1) Condition statement + what's included. (2) Item Details paragraph with accurate specs. (3) What's Included bullet list. (4) Standard shipping note. (5) Returns policy mention. (6) Questions? Message us CTA.",
  "price_guidance": "Suggested price range based on product type and condition — a range, not a guarantee",
  "category_suggestion": "Best-fit eBay category path"
}`
}

export function buildShopifyPrompt(extracted: ExtractedProduct, generationId: string): string {
  return `Create a Shopify product listing for a brand-owned store. Optimise for brand voice and Google Shopping.

${UNIQUENESS_INSTRUCTION}
Generation ID: ${generationId}

Product data:
${dataBlock(extracted)}
${voiceLine(extracted.brand_voice)}

Return ONLY valid JSON with no commentary:
{
  "title": "max 70 chars — product type + key descriptor + material/color",
  "description_html": "Valid HTML only. No markdown. Structure: <p> opening hook </p>, <ul> Key Features list </ul>, Specifications as <table> or <ul>, <p> Why You'll Love It emotional paragraph </p>, <p> Perfect For use cases </p>, <p> care/shipping note </p>",
  "meta_description": "max 320 chars — primary keyword + value proposition + click motivator",
  "alt_text": "max 125 chars — product type + colour + material",
  "product_type": "Shopify product category suggestion",
  "tags": "comma-separated — style, material, use case, target audience, season/occasion. Max 250 chars total."
}`
}

export function buildWooCommercePrompt(extracted: ExtractedProduct, generationId: string): string {
  return `Create a WooCommerce product listing. Optimise for Yoast/Rank Math SEO. Balance keyword density with natural readability.

${UNIQUENESS_INSTRUCTION}
Generation ID: ${generationId}

Product data:
${dataBlock(extracted)}
${voiceLine(extracted.brand_voice)}

Return ONLY valid JSON with no commentary:
{
  "product_name": "max 65 chars — SEO-friendly, primary keyword included, no special characters",
  "short_description": "max 150 chars — tagline style: hook + primary benefit",
  "full_description_html": "Valid HTML. No markdown. Structure: <p> opening paragraph </p>, <h3>Features</h3> <ul> list </ul>, <h3>Specifications</h3> <table> or <ul>, <h3>In The Box</h3> <ul> list </ul>, trust signals paragraph",
  "sku_suggestion": "FORMAT: CATEGORY-001",
  "weight_estimate": "in kg — only if estimable from product type, otherwise null",
  "dimensions": "null if unconfirmed — never fabricate",
  "categories": ["primary category", "subcategory", "optional third"],
  "tags": ["5-8 WordPress tags including long-tail keywords"],
  "seo": {
    "focus_keyword": "primary search term",
    "seo_title": "custom SEO title or product name",
    "meta_description": "max 155 chars — click-worthy, includes focus keyword"
  },
  "image_alt_texts": ["main image alt text", "gallery image 2 suggestion", "gallery image 3 suggestion"]
}`
}

export function buildTikTokPrompt(extracted: ExtractedProduct, generationId: string): string {
  return `Create a TikTok Shop product listing. TikTok Shop is a high-growth marketplace with a completely different buyer psychology to all other platforms. Buyers discover products through short-form video content — listings must lead with scroll-stopping hooks, social proof language, and urgency. The writing style is punchy, conversational, and trend-aware. Titles should read like a video hook. Descriptions should feel like a creator talking directly to camera.

${UNIQUENESS_INSTRUCTION}
Generation ID: ${generationId}

Product data:
${dataBlock(extracted)}
${voiceLine(extracted.brand_voice)}

Return ONLY valid JSON with no commentary:
{
  "title": "max 90 chars — lead with the strongest benefit or hook, not the product name. Conversational, scroll-stopping. No ALL CAPS.",
  "description": "Structure: (1) Hook sentence — one line that would stop a scroll. (2) 'Why everyone's buying this' — 2-3 social proof style sentences. (3) Key product details as short punchy lines (no bullet points — write as flowing short sentences). (4) 'Perfect if you...' use-case section. (5) Urgency/scarcity line if applicable (only if genuine). (6) CTA: 'Tap Add to Cart before it sells out' or similar.",
  "hashtags": ["8-12 hashtags — mix of: product-specific, niche community, trending shopping tags (#TikTokMadeMeBuyIt #ShopTikTok), and broad discovery (#smallbusiness #homedecor). No spaces in hashtags."],
  "short_video_hook": "One punchy opening line (max 15 words) designed to be spoken in a TikTok video about this product.",
  "key_selling_points": ["3-5 bullet points — each max 10 words. Ultra-concise. For use in video overlays or pinned comments."]
}`
}

// ─── Prompt dispatcher ────────────────────────────────────────────────────────

export function buildPromptForPlatform(
  platform:  Platform,
  extracted: ExtractedProduct,
  generationId: string
): string {
  switch (platform) {
    case 'amazon':      return buildAmazonPrompt(extracted, generationId)
    case 'etsy':        return buildEtsyPrompt(extracted, generationId)
    case 'ebay':        return buildEbayPrompt(extracted, generationId)
    case 'shopify':     return buildShopifyPrompt(extracted, generationId)
    case 'woocommerce': return buildWooCommercePrompt(extracted, generationId)
    case 'tiktok':      return buildTikTokPrompt(extracted, generationId)
  }
}
