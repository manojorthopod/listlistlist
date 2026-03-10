import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { getProClient, MODEL_PRO, buildImageMessages } from '@/lib/openai'
import { GENERATION_SYSTEM_PROMPT, buildPromptForPlatform, PROMPT_VERSION } from '@/lib/prompts'
import { validatePlatformOutputFromString } from '@/lib/outputValidator'
import { assertSufficientCredits, spendCredits, refundFailedCredits } from '@/lib/credits'
import { createListing, updateListing } from '@/lib/db'
import type {
  Platform,
  ExtractedProduct,
  GeneratedListings,
  GenerateResponse,
} from '@/types'

// ─── Rate limiting ────────────────────────────────────────────────────────────

const rateLimitStore = new Map<string, { count: number; windowStart: number }>()
const RATE_LIMIT_MAX    = 10
const RATE_LIMIT_WINDOW = 60_000

function checkRateLimit(userId: string): boolean {
  const now   = Date.now()
  const entry = rateLimitStore.get(userId)
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(userId, { count: 1, windowStart: now })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// ─── Input schema ─────────────────────────────────────────────────────────────

const PLATFORMS = ['amazon', 'etsy', 'ebay', 'shopify', 'woocommerce', 'tiktok'] as const

// ─── imageUrl allowlist ───────────────────────────────────────────────────────
// All legitimate images come from UploadThing CDN after the user uploads via
// the UploadDropzone. Restricting to known UploadThing hostnames prevents users
// from pointing the generation route at arbitrary external URLs to:
//   (a) consume credits on images they didn't upload through the normal flow
//   (b) use our API as a general-purpose image→listing service
//
// UploadThing CDN hostnames:
//   utfs.io       — legacy CDN (still in use)
//   *.ufs.sh      — newer per-app subdomain CDN
const ALLOWED_IMAGE_HOSTS: ReadonlySet<string> = new Set(['utfs.io'])
const ALLOWED_IMAGE_HOST_SUFFIXES: readonly string[] = ['.ufs.sh']

function isAllowedImageUrl(rawUrl: string): boolean {
  try {
    const { protocol, hostname } = new URL(rawUrl)
    if (protocol !== 'https:') return false
    if (ALLOWED_IMAGE_HOSTS.has(hostname)) return true
    return ALLOWED_IMAGE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  } catch {
    return false
  }
}

const BodySchema = z.object({
  imageUrl: z
    .string()
    .url()
    .refine(isAllowedImageUrl, {
      message: 'imageUrl must be an UploadThing CDN URL (utfs.io or *.ufs.sh)',
    }),
  imageHash:     z.string().min(1),
  extractedData: z.object({
    product_type:       z.string(),
    material:           z.string().nullable().optional(),
    color:              z.string().nullable().optional(),
    dimensions:         z.string().nullable().optional(),
    style:              z.string().nullable().optional(),
    key_features:       z.array(z.string()),
    condition:          z.enum(['New', 'Used', 'Handmade', 'Vintage']),
    suggested_category: z.string().nullable().optional(),
    target_audience:    z.string().nullable().optional(),
    brand_voice:        z.string().nullable().optional(),
  }),
  platforms: z.array(z.enum(PLATFORMS)).min(1).max(6),
})

// ─── Single-platform generation ───────────────────────────────────────────────

async function generateForPlatform(
  platform:  Platform,
  extracted: ExtractedProduct,
  imageUrl:  string
): Promise<{ platform: Platform; result: GeneratedListings[keyof GeneratedListings]; error?: string }> {
  try {
    const userPrompt = buildPromptForPlatform(platform, extracted)

    const completion = await getProClient().chat.completions.create({
      model:       MODEL_PRO,
      max_tokens:  2000,
      temperature: 0.7,
      messages:    buildImageMessages(GENERATION_SYSTEM_PROMPT, userPrompt, imageUrl),
    })

    const rawContent = completion.choices[0]?.message?.content ?? null

    const validated = validatePlatformOutputFromString(
      platform,
      rawContent,
      extracted.dimensions ?? null
    )

    if (!validated) {
      return {
        platform,
        result: null,
        error:  `Validation failed for ${platform} — output was malformed or missing required fields`,
      }
    }

    return { platform, result: validated.data as GeneratedListings[typeof platform] }
  } catch (err) {
    console.error(`[api/generate] Error generating ${platform}:`, err)
    return {
      platform,
      result: null,
      error:  `Generation failed for ${platform}: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // ── Rate limit ──────────────────────────────────────────────────────────────
  if (!checkRateLimit(userId)) {
    return Response.json(
      { error: 'Too many requests. Wait a moment and try again.' },
      { status: 429 }
    )
  }

  // ── Input validation ────────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { imageUrl, imageHash, extractedData, platforms } = parsed.data

  // ── Credit check ────────────────────────────────────────────────────────────
  let initialCredits: { subscriptionCredits: number; topupCredits: number }
  try {
    initialCredits = await assertSufficientCredits(userId, platforms.length)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Insufficient credits' },
      { status: 402 }
    )
  }

  // ── Create listing row (status: generating) ─────────────────────────────────
  let listingId: string
  try {
    const listing = await createListing({
      user_id:           userId,
      image_url:         imageUrl,
      image_hash:        imageHash,
      extracted_data:    extractedData as ExtractedProduct,
      platforms:         platforms as Platform[],
      generated_listings: null,
      prompt_version:    PROMPT_VERSION,
      status:            'generating',
      credits_used:      0,
    })
    listingId = listing.id
  } catch (err) {
    console.error('[api/generate] Failed to create listing row:', err)
    return Response.json({ error: 'Database error' }, { status: 500 })
  }

  // ── Atomic credit deduction BEFORE generation ──────────────────────────────
  let postDeductCredits: { subscriptionCredits: number; topupCredits: number }
  try {
    postDeductCredits = await spendCredits(userId, platforms.length)
  } catch {
    // Race condition — another request consumed the credits first
    await updateListing(listingId, { status: 'failed' }, userId)
    return Response.json(
      { error: 'Insufficient credits — they may have been used by another session.' },
      { status: 402 }
    )
  }

  // ── Parallel generation across all platforms ───────────────────────────────
  const results = await Promise.all(
    (platforms as Platform[]).map((platform) =>
      generateForPlatform(platform, extractedData as ExtractedProduct, imageUrl)
    )
  )

  // ── Process results: separate successes from failures ──────────────────────
  const generatedListings: GeneratedListings = {}
  const failedPlatforms: Platform[] = []
  const errors: Partial<Record<Platform, string>> = {}
  let creditsToRefund = 0

  for (const r of results) {
    if (r.result && !r.error) {
      ;(generatedListings as Record<Platform, unknown>)[r.platform] = r.result
    } else {
      failedPlatforms.push(r.platform)
      errors[r.platform] = r.error ?? `${r.platform} generation failed`
      creditsToRefund++
    }
  }

  // ── Refund credits for failed platforms ────────────────────────────────────
  if (creditsToRefund > 0) {
    try {
      await refundFailedCredits(userId, creditsToRefund)
      // Adjust the balance we'll return to the client
      postDeductCredits = {
        subscriptionCredits: Math.min(
          postDeductCredits.subscriptionCredits + creditsToRefund,
          initialCredits.subscriptionCredits
        ),
        topupCredits: postDeductCredits.topupCredits,
      }
    } catch (err) {
      // Non-fatal — log but don't fail the whole request
      console.error('[api/generate] Failed to refund credits for failed platforms:', err)
    }
  }

  const creditsUsed = platforms.length - creditsToRefund

  // ── Persist completed listing ───────────────────────────────────────────────
  const finalStatus = failedPlatforms.length === platforms.length ? 'failed' : 'completed'
  try {
    await updateListing(listingId, {
      generated_listings: generatedListings,
      status:             finalStatus,
      credits_used:       creditsUsed,
    }, userId)
  } catch (err) {
    console.error('[api/generate] Failed to update listing after generation:', err)
    // Don't fail the response — the client has the data
  }

  // ── Return ──────────────────────────────────────────────────────────────────
  const response: GenerateResponse = {
    listings:                    generatedListings,
    failedPlatforms,
    errors,
    subscriptionCreditsRemaining: postDeductCredits.subscriptionCredits,
    topupCreditsRemaining:        postDeductCredits.topupCredits,
  }

  // Attach listingId so the client can link to /listings/:id
  return Response.json({ ...response, listingId })
}
