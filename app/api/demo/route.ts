import { createHash } from 'crypto'
import { z } from 'zod'
import { getMiniClient, MODEL_MINI, buildImageMessages } from '@/lib/openai'
import { getDemoRunCounts, logDemoRun } from '@/lib/db'

// ─── Sample product image URLs ────────────────────────────────────────────────
// These are fetched server-side and sent to OpenAI as base64 data URIs.
// OpenAI's vision API does not reliably follow CDN redirects, so we proxy the
// bytes ourselves rather than handing the URL directly to the model.

const SAMPLE_URLS: Record<'mug' | 'wallet' | 'candle', string> = {
  mug:    'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&q=80&fm=jpg&fit=crop',
  wallet: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&q=80&fm=jpg&fit=crop',
  candle: 'https://images.unsplash.com/photo-1602028915047-37269d1a73f7?w=600&q=80&fm=jpg&fit=crop',
}

// ─── Image → base64 data URI ──────────────────────────────────────────────────
// Fetches a remote image and returns a base64-encoded data URI string.
// Used for the hardcoded sample images so OpenAI receives image bytes
// directly instead of a potentially-redirecting external URL.

async function fetchAsDataUri(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      // Mimic a browser Accept header so CDNs serve a real image
      Accept: 'image/jpeg,image/png,image/webp,image/*',
    },
    // Follow redirects (Node 18+ fetch does this by default, explicit here)
    redirect: 'follow',
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch sample image (${res.status} ${res.statusText}): ${url}`)
  }
  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const buffer      = await res.arrayBuffer()
  const base64      = Buffer.from(buffer).toString('base64')
  return `data:${contentType};base64,${base64}`
}

// ─── Input schema ─────────────────────────────────────────────────────────────

const BodySchema = z.object({
  imageUrl:      z.string().url().optional(),
  sampleProduct: z.enum(['mug', 'wallet', 'candle']).optional(),
}).refine(
  (d) => d.imageUrl !== undefined || d.sampleProduct !== undefined,
  { message: 'Provide either imageUrl or sampleProduct' }
)

// ─── IP hashing ───────────────────────────────────────────────────────────────

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 32)
}

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

const VALIDATION_SYSTEM = `You are an image validation assistant for an e-commerce listing tool. Determine whether the uploaded image is suitable for generating a product listing.`

const VALIDATION_USER = `Does this image contain a single, clearly identifiable physical product suitable for an e-commerce listing? Return ONLY valid JSON:
{
  "is_valid_product": boolean,
  "reason": "string — one sentence. If invalid, explain clearly."
}`

const EXTRACTION_SYSTEM = `You are a product data extraction assistant. Analyse product images and return structured JSON only. Never guess or fabricate. If a field cannot be determined from the image, return null for that field.`

const EXTRACTION_USER = `Analyse this product image and extract the following fields. Return ONLY valid JSON with no commentary.
{
  "product_type": "string — what the product is (e.g. ceramic mug, leather wallet)",
  "material": "string or null",
  "color": "string or null",
  "condition": "string — New / Used / Handmade / Vintage",
  "key_features": ["array of 2-3 strings — only clearly observable features"],
  "style": "string or null"
}`

const ETSY_PREVIEW_SYSTEM = `You are an expert Etsy copywriter. Create a compelling Etsy listing title and tags for the product described. Return only valid JSON — no markdown, no commentary.`

function buildEtsyPreviewPrompt(productData: string): string {
  return `Product data: ${productData}

Return ONLY valid JSON:
{
  "title": "max 140 chars — what it is + material + occasion or recipient + one emotional hook. No filler words.",
  "tags": ["13 tags, max 20 chars each — mix of product type, material, occasion, style, recipient. No single generic words."]
}`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeParseJson<T>(text: string | null): T | null {
  if (!text) return null
  try {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    return JSON.parse(cleaned) as T
  } catch {
    return null
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── Parse input ─────────────────────────────────────────────────────────────
  let body: unknown
  try { body = await req.json() } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Provide either imageUrl or sampleProduct (mug | wallet | candle)' },
      { status: 400 }
    )
  }

  // For sample products, fetch the image server-side and convert to a base64
  // data URI so OpenAI receives bytes directly and isn't affected by CDN redirects.
  // For user-uploaded images the UploadThing CDN URL is passed through as-is.
  let imageUrl: string
  if (parsed.data.sampleProduct) {
    try {
      imageUrl = await fetchAsDataUri(SAMPLE_URLS[parsed.data.sampleProduct])
    } catch (err) {
      console.error('[api/demo] Failed to fetch sample image:', err instanceof Error ? err.message : err)
      return Response.json({ error: 'Could not load sample image. Please try again.' }, { status: 500 })
    }
  } else {
    imageUrl = parsed.data.imageUrl!
  }

  // ── IP rate limiting ─────────────────────────────────────────────────────────
  const ip     = getClientIp(req)
  const ipHash = hashIp(ip)

  // Daily quota from env — defaults to 50
  const dailyQuota = parseInt(process.env.DEMO_DAILY_QUOTA ?? '50', 10)
  const perIpLimit = 10

  try {
    const counts = await getDemoRunCounts(ipHash)

    if (counts.ip_count >= perIpLimit) {
      return Response.json(
        { error: `Demo limit reached for today. Sign up for full access — it's free.` },
        { status: 429 }
      )
    }

    if (counts.total_count >= dailyQuota) {
      return Response.json(
        { error: 'Daily demo quota reached. Sign up for full access — it\'s free.' },
        { status: 429 }
      )
    }
  } catch (err) {
    // If rate limit check fails, allow through but log
    console.error('[api/demo] Rate limit check failed:', err)
  }

  const client = getMiniClient()

  // ── Step 0: Validate image ───────────────────────────────────────────────────
  try {
    const validationCompletion = await client.chat.completions.create({
      model:       MODEL_MINI,
      max_tokens:  150,
      temperature: 0,
      messages:    buildImageMessages(VALIDATION_SYSTEM, VALIDATION_USER, imageUrl, 'low'),
    })

    const validationRaw  = validationCompletion.choices[0]?.message?.content ?? null
    const validationData = safeParseJson<{ is_valid_product: boolean; reason: string }>(validationRaw)

    if (!validationData?.is_valid_product) {
      return Response.json(
        {
          error:     validationData?.reason ?? 'No product found in this image.',
          is_valid:  false,
        },
        { status: 422 }
      )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status  = (err as { status?: number }).status
    console.error('[api/demo] Validation error — OpenAI call failed:', { message, status, err })
    return Response.json({ error: 'Image analysis failed. Please try again.' }, { status: 500 })
  }

  // ── Step 1: Extract product data ─────────────────────────────────────────────
  let productSummary = ''
  try {
    const extractCompletion = await client.chat.completions.create({
      model:       MODEL_MINI,
      max_tokens:  400,
      temperature: 0,
      messages:    buildImageMessages(EXTRACTION_SYSTEM, EXTRACTION_USER, imageUrl, 'low'),
    })

    const extractRaw  = extractCompletion.choices[0]?.message?.content ?? null
    const extractData = safeParseJson<Record<string, unknown>>(extractRaw)

    productSummary = extractData ? JSON.stringify(extractData) : 'A physical product'
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[api/demo] Extraction error:', { message, err })
    productSummary = 'A physical product'
  }

  // ── Step 2: Generate Etsy preview (title + tags only) ────────────────────────
  let etsyPreview: { title: string; tags: string[] } | null = null
  try {
    const etsyCompletion = await client.chat.completions.create({
      model:       MODEL_MINI,
      max_tokens:  400,
      temperature: 0.7,
      messages:    [
        { role: 'system', content: ETSY_PREVIEW_SYSTEM },
        { role: 'user',   content: buildEtsyPreviewPrompt(productSummary) },
      ],
    })

    const etsyRaw  = etsyCompletion.choices[0]?.message?.content ?? null
    const etsyData = safeParseJson<{ title: string; tags: string[] }>(etsyRaw)

    if (etsyData?.title && Array.isArray(etsyData.tags)) {
      etsyPreview = {
        title: etsyData.title.slice(0, 140),
        tags:  etsyData.tags.slice(0, 13).map((t: string) => t.slice(0, 20)),
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[api/demo] Etsy generation error:', { message, err })
  }

  if (!etsyPreview) {
    return Response.json({ error: 'Generation failed. Please try again.' }, { status: 500 })
  }

  // ── Log demo run ─────────────────────────────────────────────────────────────
  try {
    await logDemoRun(ipHash)
  } catch (err) {
    console.error('[api/demo] Failed to log demo run:', err)
  }

  return Response.json({
    etsy_preview: {
      title: etsyPreview.title,
      tags:  etsyPreview.tags,
    },
  })
}
