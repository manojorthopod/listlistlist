import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { getMiniClient, MODEL_MINI, buildImageMessages, parseJsonResponse } from '@/lib/openai'
import { getUserById } from '@/lib/db'
import type { ExtractedProduct } from '@/types'

// ─── Rate limiting ────────────────────────────────────────────────────────────

const rateLimitStore = new Map<string, { count: number; windowStart: number }>()
const RATE_LIMIT_MAX    = 20
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

// ─── Prompts ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a product data extraction assistant for e-commerce listings. \
Analyse images of sellable items of any size — from small goods to vehicles, furniture, and parts. \
Return structured JSON only. Never guess dimensions, mileage, specs, or numbers not visible in the image. \
If you cannot determine a field from the image, use null or an empty array as instructed. \
When you are unsure of the exact product name or sparse details, set extraction_incomplete to true \
and write a short manual_entry_hint telling the seller what to type (e.g. make/model, material, condition).`

const USER_PROMPT = `Analyse this image and extract listing fields. Works for small products, \
furniture, vehicles (cars, motorcycles, vans), automotive parts, appliances, and other sellable items.

Rules:
- product_type: concise name (e.g. sectional sofa, hatchback, LED headlight assembly). Use "" only if you cannot name the item.
- key_features: 0–8 short observable facts (trim, damage, included parts, upholstery). [] if none are clear.
- condition: New, Used, Handmade, or Vintage (best visible guess).
- extraction_incomplete: true if product_type is empty/vague OR the photo does not support specific features and the seller should type details manually.
- manual_entry_hint: if extraction_incomplete, one sentence on what to enter (make/model, year, material, mileage only if visible, etc.). Otherwise null.

Return ONLY valid JSON with no commentary. Example shape (replace with real values):
{
  "product_type": "Leather two-seater sofa",
  "material": "Leather",
  "color": "Brown",
  "dimensions": null,
  "style": "Contemporary",
  "key_features": ["Button tufting", "Metal legs"],
  "condition": "Used",
  "suggested_category": "Home & Garden > Furniture",
  "extraction_incomplete": false,
  "manual_entry_hint": null
}

CRITICAL: Never fabricate dimensions, mileage, engine size, or measurements not visible in the image.`

const CONDITIONS = ['New', 'Used', 'Handmade', 'Vintage'] as const
type Condition = (typeof CONDITIONS)[number]

// ─── Permissive model output (then normalise to ExtractedProduct) ─────────────

const RawExtractionSchema = z.object({
  product_type:          z.union([z.string(), z.null()]).optional(),
  material:              z.union([z.string(), z.null()]).optional(),
  color:                 z.union([z.string(), z.null()]).optional(),
  dimensions:            z.union([z.string(), z.null()]).optional(),
  style:                 z.union([z.string(), z.null()]).optional(),
  key_features:          z.array(z.string()).optional(),
  condition:             z.union([z.string(), z.null()]).optional(),
  suggested_category:    z.union([z.string(), z.null()]).optional(),
  extraction_incomplete: z.boolean().optional(),
  manual_entry_hint:     z.union([z.string(), z.null()]).optional(),
})

function normaliseCondition(raw: string | null | undefined): Condition {
  if (!raw) return 'New'
  const t = raw.trim()
  for (const c of CONDITIONS) {
    if (c.toLowerCase() === t.toLowerCase()) return c
  }
  return 'New'
}

function trimOrNull(v: string | null | undefined): string | null {
  if (v == null) return null
  const t = String(v).trim()
  return t.length ? t : null
}

function buildFallbackExtraction(
  userBrandVoice: string | null,
  hint: string
): ExtractedProduct {
  return {
    product_type:          '',
    material:              null,
    color:                 null,
    dimensions:            null,
    style:                 null,
    key_features:          [],
    condition:             'New',
    suggested_category:    null,
    target_audience:       null,
    brand_voice:           userBrandVoice,
    extraction_incomplete: true,
    manual_entry_hint:     hint,
  }
}

function normaliseToExtracted(
  raw: z.infer<typeof RawExtractionSchema>,
  userBrandVoice: string | null
): ExtractedProduct {
  const product_type = (raw.product_type ?? '').trim()
  const key_features = (raw.key_features ?? [])
    .map((s) => String(s).trim())
    .filter((s) => s.length > 0)

  let extraction_incomplete = raw.extraction_incomplete === true
  if (!product_type) extraction_incomplete = true

  const defaultHint =
    'We could not fully identify this item from the photo. Enter the product name, make or model if applicable, and key details below.'

  const manual_entry_hint =
    trimOrNull(raw.manual_entry_hint ?? undefined) ??
    (extraction_incomplete ? defaultHint : null)

  return {
    product_type,
    material:              trimOrNull(raw.material ?? undefined),
    color:                 trimOrNull(raw.color ?? undefined),
    dimensions:            trimOrNull(raw.dimensions ?? undefined),
    style:                 trimOrNull(raw.style ?? undefined),
    key_features:          key_features.length ? key_features : [],
    condition:             normaliseCondition(raw.condition ?? undefined),
    suggested_category:    trimOrNull(raw.suggested_category ?? undefined),
    target_audience:       null,
    brand_voice:           userBrandVoice,
    extraction_incomplete,
    manual_entry_hint,
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

const BodySchema = z.object({
  imageUrl: z.string().url(),
})

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

  const user = await getUserById(userId)
  const userBrandVoice = user?.brand_voice ?? null

  const fallbackHint =
    'We could not read structured details from this image. Enter the product name and key details manually.'

  let extracted: ExtractedProduct

  try {
    const completion = await getMiniClient().chat.completions.create({
      model:       MODEL_MINI,
      max_tokens:  700,
      temperature: 0,
      messages:    buildImageMessages(SYSTEM_PROMPT, USER_PROMPT, parsed.data.imageUrl),
    })

    const content = completion.choices[0]?.message?.content ?? null
    const jsonRaw = parseJsonResponse<unknown>(content)

    if (!jsonRaw) {
      console.error('[api/extract] Could not parse JSON from model response:', content)
      extracted = buildFallbackExtraction(userBrandVoice, fallbackHint)
    } else {
      const validated = RawExtractionSchema.safeParse(jsonRaw)
      if (!validated.success) {
        console.error('[api/extract] Raw schema validation failed:', validated.error.flatten())
        extracted = buildFallbackExtraction(userBrandVoice, fallbackHint)
      } else {
        extracted = normaliseToExtracted(validated.data, userBrandVoice)
      }
    }
  } catch (err) {
    console.error('[api/extract] OpenAI error:', err)
    return Response.json(
      { error: 'Image analysis failed. Please try again.' },
      { status: 502 }
    )
  }

  return Response.json({
    extracted_data: extracted,
    extraction_incomplete: extracted.extraction_incomplete === true,
  })
}
