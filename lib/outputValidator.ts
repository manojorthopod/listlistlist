/**
 * lib/outputValidator.ts
 *
 * Post-processing validation for all generated platform listings.
 * Runs on every GPT-4o output BEFORE it is stored in the database or
 * displayed in the UI. Raw model output is never passed directly to the UI.
 *
 * Responsibilities:
 *  1. Parse JSON safely — malformed JSON = null (unrecoverable, triggers credit refund)
 *  2. Strip markdown artefacts from all string fields
 *  3. Enforce per-platform character / byte / word limits (truncate, don't throw)
 *  4. Null-check required fields — empty title or description = null (unrecoverable)
 *  5. Strip fabricated dimensions from WooCommerce output when unconfirmed
 *  6. Log every truncation and strip to the server console for monitoring
 */

import type {
  Platform,
  ValidatedOutput,
  AmazonListing,
  EtsyListing,
  EbayListing,
  ShopifyListing,
  WooCommerceListing,
  TikTokListing,
} from '@/types'

// ─── Character / word limits (exact values from spec) ────────────────────────

const LIMITS = {
  amazon: {
    title:        200,
    description:  2000,
    searchTerms:  250,   // bytes, not chars — handled separately
    bulletMax:    5,     // number of bullets kept
  },
  etsy: {
    title:        140,
    tagCharMax:   20,    // per tag
    tagCountMax:  13,
  },
  ebay: {
    title:        80,
  },
  shopify: {
    title:            70,
    metaDescription:  320,
    altText:          125,
    tags:             250,
  },
  woocommerce: {
    productName:       65,
    shortDescription:  150,
    seoMetaDesc:       155,
  },
  tiktok: {
    title:            90,
    hookWordMax:      15,    // words, not chars
    sellingPointWords: 10,   // words per bullet
    hashtagMin:       8,
    hashtagMax:       12,
  },
} as const

// ─── Markdown stripping ───────────────────────────────────────────────────────

/**
 * Removes markdown artefacts from a plain-text string.
 * Patterns removed: **, __, ##, #, *, _, `, ~~~
 *
 * NOTE: Not applied to HTML fields (description_html, full_description_html)
 * because HTML tags share syntax with some of these characters.
 */
function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*/g, '')        // bold (**)
    .replace(/(?<!\w)_([^_]+)_(?!\w)/g, '$1') // italic emphasis (_text_) — word-boundary only
    .replace(/__/g, '')                        // bold alt (__) — any remnants
    .replace(/###+/g, '')        // h3+
    .replace(/##/g, '')          // h2
    .replace(/^#\s/gm, '')       // h1 (line-start only — avoids stripping # in e.g. #FF0000)
    .replace(/\*/g, '')          // remaining asterisks (italic, unordered list markers)
    .replace(/`/g, '')           // inline code backticks
    .replace(/~~[^~]*~~/g, '')   // strikethrough (~~text~~)
    .replace(/~/g, '')           // remaining tildes
    .replace(/\s{2,}/g, ' ')     // collapse extra spaces left by removals
    .trim()
}

// ─── Truncation helpers ───────────────────────────────────────────────────────

/**
 * Truncates a string to `limit` characters.
 * Records the field name if truncation occurred.
 */
function truncateChars(
  value:     string,
  limit:     number,
  fieldName: string,
  log:       string[]
): string {
  if (value.length <= limit) return value
  log.push(fieldName)
  console.warn(`[outputValidator] Truncated "${fieldName}" from ${value.length} to ${limit} chars`)
  return value.slice(0, limit).trimEnd()
}

/**
 * Truncates a string so its UTF-8 byte length does not exceed `limitBytes`.
 * Used for Amazon search_terms (250-byte limit).
 */
function truncateBytes(
  value:     string,
  limitBytes: number,
  fieldName: string,
  log:       string[]
): string {
  const encoded = new TextEncoder().encode(value)
  if (encoded.length <= limitBytes) return value
  log.push(fieldName)
  console.warn(
    `[outputValidator] Truncated "${fieldName}" from ${encoded.length} to ${limitBytes} bytes`
  )
  // Decode back the sliced bytes, then trim any partial multi-byte character
  return new TextDecoder().decode(encoded.slice(0, limitBytes)).replace(/\uFFFD$/, '').trimEnd()
}

/**
 * Truncates a string to `maxWords` words.
 */
function truncateWords(
  value:    string,
  maxWords: number,
  fieldName: string,
  log:      string[]
): string {
  const words = value.trim().split(/\s+/)
  if (words.length <= maxWords) return value
  log.push(fieldName)
  console.warn(
    `[outputValidator] Truncated "${fieldName}" from ${words.length} to ${maxWords} words`
  )
  return words.slice(0, maxWords).join(' ')
}

// ─── Required-field guards ────────────────────────────────────────────────────

/**
 * Returns true if a value is a non-empty string (not blank/whitespace-only).
 */
function isPresent(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Returns a safe string or null.
 * Used for optional text fields: strips markdown, returns null if empty.
 */
function safeStr(value: unknown, stripped: string[], field: string): string | null {
  if (!isPresent(value)) return null
  const clean = stripMarkdown(String(value))
  if (clean.length < String(value).length) stripped.push(field)
  return clean || null
}

/**
 * Returns a safe string array (each item stripped, empties removed).
 */
function safeStrArray(value: unknown, stripped: string[], field: string): string[] {
  if (!Array.isArray(value)) return []
  const original = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  const cleaned  = original.map(stripMarkdown).filter(Boolean)
  if (cleaned.join() !== original.join()) stripped.push(field)
  return cleaned
}

// ─── Platform validators ──────────────────────────────────────────────────────

function validateAmazon(
  raw:       unknown,
  truncated: string[],
  stripped:  string[]
): AmazonListing | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  // Required fields
  if (!isPresent(r.title))       return null
  if (!isPresent(r.description)) return null

  const rawTitle = stripMarkdown(String(r.title))
  if (rawTitle !== String(r.title)) stripped.push('title')

  const rawDesc = stripMarkdown(String(r.description))
  if (rawDesc !== String(r.description)) stripped.push('description')

  const rawSearchTerms = safeStr(r.search_terms, stripped, 'search_terms') ?? ''

  // Bullets — strip markdown, cap at 5
  const rawBullets = safeStrArray(r.bullets, stripped, 'bullets')
  const bullets    = rawBullets.slice(0, LIMITS.amazon.bulletMax)
  if (rawBullets.length > LIMITS.amazon.bulletMax) truncated.push('bullets')

  return {
    title:        truncateChars(rawTitle,       LIMITS.amazon.title,       'title',        truncated),
    bullets,
    description:  truncateChars(rawDesc,        LIMITS.amazon.description, 'description',  truncated),
    search_terms: truncateBytes(rawSearchTerms, LIMITS.amazon.searchTerms, 'search_terms', truncated),
  }
}

function validateEtsy(
  raw:       unknown,
  truncated: string[],
  stripped:  string[]
): EtsyListing | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  if (!isPresent(r.title))       return null
  if (!isPresent(r.description)) return null

  const rawTitle = stripMarkdown(String(r.title))
  if (rawTitle !== String(r.title)) stripped.push('title')

  const rawDesc = stripMarkdown(String(r.description))
  if (rawDesc !== String(r.description)) stripped.push('description')

  // Tags — strip markdown, enforce per-tag char limit, cap at 13
  const rawTags = safeStrArray(r.tags, stripped, 'tags')
  const tags: string[] = []
  for (const tag of rawTags.slice(0, LIMITS.etsy.tagCountMax)) {
    tags.push(truncateChars(tag, LIMITS.etsy.tagCharMax, `tags[${tags.length}]`, truncated))
  }
  if (rawTags.length > LIMITS.etsy.tagCountMax) truncated.push('tags_count')

  return {
    title:       truncateChars(rawTitle, LIMITS.etsy.title, 'title', truncated),
    description: rawDesc,
    tags,
  }
}

function validateEbay(
  raw:       unknown,
  truncated: string[],
  stripped:  string[]
): EbayListing | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  if (!isPresent(r.title))       return null
  if (!isPresent(r.description)) return null

  const rawTitle = stripMarkdown(String(r.title))
  if (rawTitle !== String(r.title)) stripped.push('title')

  const rawDesc = stripMarkdown(String(r.description))
  if (rawDesc !== String(r.description)) stripped.push('description')

  // item_specifics — all values stripped of markdown
  const specs = (r.item_specifics && typeof r.item_specifics === 'object')
    ? (r.item_specifics as Record<string, unknown>)
    : {}

  return {
    title:       truncateChars(rawTitle, LIMITS.ebay.title, 'title', truncated),
    description: rawDesc,
    item_specifics: {
      Condition: safeStr(specs.Condition, stripped, 'item_specifics.Condition') ?? 'New',
      Brand:     safeStr(specs.Brand,     stripped, 'item_specifics.Brand')     ?? 'Unbranded',
      Material:  safeStr(specs.Material,  stripped, 'item_specifics.Material'),
      Color:     safeStr(specs.Color,     stripped, 'item_specifics.Color'),
      Size:      safeStr(specs.Size,      stripped, 'item_specifics.Size'),
    },
    price_guidance:    safeStr(r.price_guidance,    stripped, 'price_guidance')    ?? '',
    category_suggestion: safeStr(r.category_suggestion, stripped, 'category_suggestion') ?? '',
  }
}

function validateShopify(
  raw:       unknown,
  truncated: string[],
  stripped:  string[]
): ShopifyListing | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  if (!isPresent(r.title))            return null
  if (!isPresent(r.description_html)) return null

  const rawTitle = stripMarkdown(String(r.title))
  if (rawTitle !== String(r.title)) stripped.push('title')

  // description_html is HTML — do NOT strip markdown patterns (tags use similar syntax)
  // but do verify it's a non-empty string
  const descHtml = String(r.description_html).trim()

  const rawMeta   = safeStr(r.meta_description, stripped, 'meta_description') ?? ''
  const rawAlt    = safeStr(r.alt_text,         stripped, 'alt_text')         ?? ''
  const rawTags   = safeStr(r.tags,             stripped, 'tags')             ?? ''
  const rawPType  = safeStr(r.product_type,     stripped, 'product_type')     ?? ''

  return {
    title:            truncateChars(rawTitle,  LIMITS.shopify.title,           'title',           truncated),
    description_html: descHtml,
    meta_description: truncateChars(rawMeta,   LIMITS.shopify.metaDescription, 'meta_description', truncated),
    alt_text:         truncateChars(rawAlt,    LIMITS.shopify.altText,         'alt_text',         truncated),
    product_type:     rawPType,
    tags:             truncateChars(rawTags,   LIMITS.shopify.tags,            'tags',             truncated),
  }
}

function validateWooCommerce(
  raw:                 unknown,
  truncated:           string[],
  stripped:            string[],
  confirmedDimensions: string | null | undefined
): WooCommerceListing | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  if (!isPresent(r.product_name))          return null
  if (!isPresent(r.full_description_html)) return null

  const rawName    = stripMarkdown(String(r.product_name))
  if (rawName !== String(r.product_name)) stripped.push('product_name')

  // full_description_html is HTML — preserve as-is
  const descHtml = String(r.full_description_html).trim()

  const rawShortDesc  = safeStr(r.short_description, stripped, 'short_description') ?? ''
  const rawSku        = safeStr(r.sku_suggestion,     stripped, 'sku_suggestion')     ?? ''
  const rawWeight     = safeStr(r.weight_estimate,    stripped, 'weight_estimate')
  const categories    = safeStrArray(r.categories,    stripped, 'categories')
  const tags          = safeStrArray(r.tags,          stripped, 'tags')
  const altTexts      = safeStrArray(r.image_alt_texts, stripped, 'image_alt_texts')

  // ── Fabricated dimensions guard ─────────────────────────────────────────
  // If the user did NOT confirm dimensions (confirmedDimensions is null/undefined)
  // but the model output contains a dimensions value, strip it silently.
  let dimensions: string | null = safeStr(r.dimensions, stripped, 'dimensions')
  if (dimensions && !confirmedDimensions) {
    console.warn('[outputValidator] Stripped fabricated dimensions from WooCommerce output')
    stripped.push('dimensions')
    dimensions = null
  }

  // SEO object
  const seoRaw = (r.seo && typeof r.seo === 'object') ? (r.seo as Record<string, unknown>) : {}
  const seoMetaRaw = safeStr(seoRaw.meta_description, stripped, 'seo.meta_description') ?? ''

  return {
    product_name:          truncateChars(rawName,        LIMITS.woocommerce.productName,      'product_name',      truncated),
    short_description:     truncateChars(rawShortDesc,   LIMITS.woocommerce.shortDescription, 'short_description', truncated),
    full_description_html: descHtml,
    sku_suggestion:        rawSku,
    weight_estimate:       rawWeight,
    dimensions,
    categories,
    tags,
    seo: {
      focus_keyword:   safeStr(seoRaw.focus_keyword, stripped, 'seo.focus_keyword') ?? '',
      seo_title:       safeStr(seoRaw.seo_title,     stripped, 'seo.seo_title')     ?? rawName,
      meta_description: truncateChars(seoMetaRaw, LIMITS.woocommerce.seoMetaDesc, 'seo.meta_description', truncated),
    },
    image_alt_texts: altTexts,
  }
}

function validateTikTok(
  raw:       unknown,
  truncated: string[],
  stripped:  string[]
): TikTokListing | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  if (!isPresent(r.title))       return null
  if (!isPresent(r.description)) return null

  const rawTitle = stripMarkdown(String(r.title))
  if (rawTitle !== String(r.title)) stripped.push('title')

  const rawDesc = stripMarkdown(String(r.description))
  if (rawDesc !== String(r.description)) stripped.push('description')

  const rawHook = safeStr(r.short_video_hook, stripped, 'short_video_hook') ?? ''

  // Hashtags — strip markdown, enforce count range (keep up to max, warn below min)
  const rawHashtags = safeStrArray(r.hashtags, stripped, 'hashtags')
  const hashtags = rawHashtags.slice(0, LIMITS.tiktok.hashtagMax)
  if (rawHashtags.length > LIMITS.tiktok.hashtagMax) {
    truncated.push('hashtags')
    console.warn(
      `[outputValidator] Truncated hashtags from ${rawHashtags.length} to ${LIMITS.tiktok.hashtagMax}`
    )
  }
  if (hashtags.length < LIMITS.tiktok.hashtagMin) {
    console.warn(
      `[outputValidator] TikTok hashtags below minimum (${hashtags.length} < ${LIMITS.tiktok.hashtagMin})`
    )
  }

  // key_selling_points — strip markdown, enforce per-bullet word limit
  const rawKsp = safeStrArray(r.key_selling_points, stripped, 'key_selling_points')
  const key_selling_points = rawKsp
    .slice(0, 5)
    .map((point, i) =>
      truncateWords(point, LIMITS.tiktok.sellingPointWords, `key_selling_points[${i}]`, truncated)
    )

  return {
    title:              truncateChars(rawTitle, LIMITS.tiktok.title, 'title', truncated),
    description:        rawDesc,
    hashtags,
    short_video_hook:   truncateWords(rawHook, LIMITS.tiktok.hookWordMax, 'short_video_hook', truncated),
    key_selling_points,
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Validates and sanitises a single platform's generated output.
 *
 * @param platform             - Which platform this output is for.
 * @param raw                  - The raw value from JSON.parse (already parsed upstream),
 *                               or the raw unknown response from the model.
 * @param confirmedDimensions  - The dimensions string from the user-confirmed
 *                               ExtractedProduct. Pass null/undefined if the user
 *                               left dimensions blank — the validator will strip
 *                               any dimensions the model fabricated.
 *
 * @returns ValidatedOutput with cleaned data + audit arrays, or null if the
 *          output is unrecoverable (missing required title + description fields).
 *          A null return signals a platform failure → refund that platform's credit.
 */
export function validatePlatformOutput(
  platform:            Platform,
  raw:                 unknown,
  confirmedDimensions?: string | null
): ValidatedOutput | null {
  const truncated: string[] = []
  const stripped:  string[] = []

  let data: AmazonListing | EtsyListing | EbayListing | ShopifyListing | WooCommerceListing | TikTokListing | null = null

  switch (platform) {
    case 'amazon':
      data = validateAmazon(raw, truncated, stripped)
      break
    case 'etsy':
      data = validateEtsy(raw, truncated, stripped)
      break
    case 'ebay':
      data = validateEbay(raw, truncated, stripped)
      break
    case 'shopify':
      data = validateShopify(raw, truncated, stripped)
      break
    case 'woocommerce':
      data = validateWooCommerce(raw, truncated, stripped, confirmedDimensions)
      break
    case 'tiktok':
      data = validateTikTok(raw, truncated, stripped)
      break
    default:
      console.error(`[outputValidator] Unknown platform: ${platform}`)
      return null
  }

  if (!data) {
    console.error(
      `[outputValidator] Unrecoverable output for platform "${platform}" — missing required fields`
    )
    return null
  }

  if (truncated.length > 0) {
    console.warn(
      `[outputValidator] Truncated fields for ${platform}: ${truncated.join(', ')}`
    )
  }
  if (stripped.length > 0) {
    console.warn(
      `[outputValidator] Stripped fields for ${platform}: ${stripped.join(', ')}`
    )
  }

  return {
    platform,
    data,
    truncatedFields: truncated,
    strippedFields:  stripped,
  }
}

/**
 * Convenience wrapper: parses a raw JSON string from the model, then validates.
 * Use this when you have the model's raw text content, not a pre-parsed object.
 *
 * Returns null on JSON parse failure (treat as platform failure).
 */
export function validatePlatformOutputFromString(
  platform:            Platform,
  rawJsonString:       string | null | undefined,
  confirmedDimensions?: string | null
): ValidatedOutput | null {
  if (!rawJsonString) {
    console.error(`[outputValidator] Empty content string for platform "${platform}"`)
    return null
  }

  let parsed: unknown
  try {
    // Strip optional markdown code fences the model sometimes wraps around JSON
    const cleaned = rawJsonString
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    parsed = JSON.parse(cleaned)
  } catch (err) {
    console.error(
      `[outputValidator] JSON parse failure for platform "${platform}":`,
      err,
      '\nRaw content (first 200 chars):',
      rawJsonString.slice(0, 200)
    )
    return null
  }

  return validatePlatformOutput(platform, parsed, confirmedDimensions)
}
