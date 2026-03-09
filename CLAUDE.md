HOW TO USE THIS DOCUMENT Use this as a cursor.rules or CLAUDE.md file in your AI IDE (Cursor, Windsurf, etc.). Do not paste it into a chat interface and ask the AI to build everything at once — it will hit its output limit mid-file. Instead, reference the BUILD ORDER section and prompt one section at a time: "Using our project rules, implement Step 1: database schema and Supabase setup."

Build an AI-powered e-commerce listing generator called "ListListList". Users upload a product photo, confirm extracted product details, select which platforms they want listings for, and receive optimised copy-paste-ready listings.

COMMERCIAL MODEL
Pricing Tiers
No free tier. Replace with a 7-day free trial (10 credits, full access, no watermarks)
Starter: £39/month — 50 credits/month
Pro: £79/month — 1,000 credits/month + priority generation
Do not describe Pro as "unlimited" anywhere in the UI. "1,000 credits/month" is more specific, sounds more substantial, and sets accurate expectations.
Bulk upload (up to 10 images at once) is a planned Pro feature. It is NOT built in v1. Display "Bulk upload — coming soon" on the Pro tier card and in the Pro dashboard. Do not build any bulk upload logic yet.
Annual Billing
Offer annual billing from day one — it reduces Stripe transaction fees ~8x and improves cash flow significantly.
Starter Annual: £390/year (2 months free — saves £78)
Pro Annual: £790/year (2 months free — saves £158)
Annual subscribers receive the same monthly credit allowance and rollover cap as monthly subscribers. Store billing_interval: enum ('monthly', 'annual') on the users table. Handle both price_id variants in the Stripe webhook.
Credit Logic
Credits are consumed per platform per generation, not per upload.
1 upload + 3 platforms selected = 3 credits deducted
Show credit cost preview before generation begins: "This will use 3 credits. You have 47 remaining."
Credit deduction is atomic (Supabase RPC transaction) to prevent race conditions on concurrent requests
If image validation fails (Step 0), zero credits are deducted
If a generation partially fails (some platforms error), only deduct credits for platforms that successfully completed
Credit Rollover Policy
Unused credits roll over to the following month, but are capped:
Starter: maximum banked credits = 100 (2 months' worth)
Pro: maximum banked credits = 2,000 (2 months' worth)
Apply the rollover cap on the monthly renewal date via a Supabase scheduled function. Logic: new_balance = MIN(current_credits + monthly_allowance, rollover_cap). This prevents users stockpiling credits across quiet months and then generating a cost spike in a single session.
Top-Up Credit Packs
Users can purchase additional credits as a one-time purchase at any time, regardless of plan. Top-ups are not subscriptions. Credits from top-up packs never expire and are consumed after monthly subscription credits (subscription credits are used first, top-up credits second — track separately).
Pack
Credits
Price
Per credit
Starter pack
100 credits
£14
£0.14/credit
Growth pack
300 credits
£35
£0.12/credit
Scale pack
700 credits
£70
£0.10/credit

Top-up packs are deliberately priced at 1.3–1.8x the Pro subscription rate per credit, preserving the incentive to subscribe rather than rely on top-ups. Implement via a dedicated Stripe Checkout session (mode: payment, not subscription). On successful payment webhook, add the purchased credits to users.topup_credits.
Referral Programme
Each paying user gets a unique referral link
Successful referral (new paying subscriber) = 10 bonus credits (added to topup_credits) awarded to referrer
Tracked in a dedicated referrals table
Surface the referral link prominently: in the dashboard referral widget, on the account page, in the post-generation results screen ("Your listing is ready! Know another seller? Share ListListList →"), and in the email sequence

TECH STACK
Next.js 14 (App Router) + TypeScript + Tailwind CSS
Clerk for authentication (Google OAuth)
Supabase (PostgreSQL) for database
UploadThing for image storage
OpenAI API: GPT-4o-mini for image validation and vision extraction (cheaper, sufficient for JSON tasks) + GPT-4o for listing generation (quality matters here)
Stripe for payments (Checkout + Webhooks + Customer Portal) — supports both monthly and annual billing intervals
Resend for transactional email (onboarding sequence + credit alerts)
Vercel for deployment


DESIGN SYSTEM
This design system must be applied to every component, page, and UI element built in this project. Do not deviate from these tokens. Consistency is non-negotiable — every screen should feel like it was designed by the same hand.
Brand Identity
Name: ListListList Wordmark: "listlistlist" — all lowercase, Geist Bold. No icon required at launch. Favicon: The text /// in Geist Mono, violet on near-black. Brand voice in UI copy: Direct, confident, no filler words. Every label, button, and message should be the shortest version of itself that still communicates clearly. Never use "please", "simply", or "just". Never use exclamation marks except in success states.

Colour Palette
Implement these as Tailwind CSS custom colours in tailwind.config.ts. Use these token names throughout — never hardcode hex values in components.
ts
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'base':        '#0A0A0F', // page background — near black with a blue undertone
        'surface':     '#13131A', // card / panel background
        'surface-2':   '#1C1C28', // elevated surface (modals, dropdowns)
        'border':      '#222230', // default border
        'border-2':    '#2E2E42', // hover / focus border

        // Brand accent
        'accent':      '#7C3AED', // primary violet
        'accent-hover':'#6D28D9', // darker on hover
        'accent-light':'#8B5CF6', // lighter variant for glows and gradients
        'accent-muted':'#7C3AED26', // violet at 15% opacity — for subtle backgrounds

        // Text
        'text-primary':   '#F8F8FF', // headings and primary body
        'text-secondary': '#8888AA', // subtext, labels, captions
        'text-disabled':  '#44445A', // disabled states

        // Semantic
        'success':     '#10B981', // green — credits added, copy confirmed
        'success-muted':'#10B98120',
        'warning':     '#F59E0B', // amber — trial expiry, low credits
        'warning-muted':'#F59E0B20',
        'error':       '#F43F5E', // rose — platform failure, validation error
        'error-muted': '#F43F5E20',

        // Platform accent colours — used for card glows and platform badges
        'platform-amazon':    '#FF9900',
        'platform-etsy':      '#F1641E',
        'platform-ebay':      '#E53238',
        'platform-shopify':   '#96BF48',
        'platform-woo':       '#7F54B3',
        'platform-tiktok':    '#FF004F',
      },
    },
  },
}

export default config
Usage rules:
Page backgrounds: always bg-base
Cards and panels: always bg-surface with border border-border
Primary buttons: bg-accent hover:bg-accent-hover
Ghost buttons: border border-border-2 hover:border-accent text-text-primary
Never use white (#FFFFFF) as a background — use text-primary for white-ish text only
Error states: bg-error-muted border border-error text-error
Success states: bg-success-muted border border-success text-success

Typography
Install via Next.js font system (next/font). Both fonts are free.
ts
// app/layout.tsx
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
```

If Geist is unavailable, fallback to Inter for sans and JetBrains Mono for mono.

| Role | Font | Weight | Size | Tailwind class |
|---|---|---|---|---|
| Page headline (hero) | Geist Sans | 800 | 56–72px | `text-6xl font-extrabold tracking-tight` |
| Section heading | Geist Sans | 700 | 32px | `text-3xl font-bold tracking-tight` |
| Card heading | Geist Sans | 600 | 20px | `text-xl font-semibold` |
| Body text | Geist Sans | 400 | 16px | `text-base font-normal` |
| Small label / caption | Geist Sans | 400 | 13px | `text-sm text-text-secondary` |
| Generated listing output | Geist Mono | 400 | 14px | `font-mono text-sm` |
| Code / API copy | Geist Mono | 400 | 13px | `font-mono text-xs` |

**Typography rules:**
- Headings are always `text-text-primary`
- Never center-align body copy — only hero headlines and short stat callouts
- Generated listing text always renders in Geist Mono inside a `bg-surface-2` container — it should feel like precision output from a machine, not a text box
- Character count indicators (e.g. "187/200") render in `text-text-secondary text-xs font-mono` to the right of the field

---

### Spacing & Layout

- Max page width: `max-w-6xl` (1152px) centred with `mx-auto px-6`
- Section vertical padding: `py-24` on landing page, `py-12` on app pages
- Card padding: `p-6` standard, `p-4` for compact cards
- Gap between grid items: `gap-6`
- Stack spacing between form fields: `space-y-4`

---

### Components

#### Buttons
```
Primary:   bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg px-5 py-2.5 transition-colors duration-150
Ghost:     border border-border-2 hover:border-accent text-text-primary font-medium rounded-lg px-5 py-2.5 transition-colors duration-150
Danger:    bg-error-muted hover:bg-error text-error hover:text-white border border-error rounded-lg px-5 py-2.5 transition-colors duration-150
Disabled:  opacity-40 cursor-not-allowed (apply to any variant)
```

All buttons use `rounded-lg` (8px). No `rounded-full` pill buttons anywhere in the app — that reads as consumer/marketing, not tool.

#### Cards
```
Standard card:   bg-surface border border-border rounded-xl p-6
Elevated card:   bg-surface-2 border border-border-2 rounded-xl p-6
Hover card:      Standard card + hover:border-border-2 transition-colors duration-150
Active/selected: border-accent bg-accent-muted
```

#### Platform Toggle Cards (Step 1 of /generate)

Each platform card has its own hover glow using the platform accent colour. On hover, the card border transitions to that platform's colour at 60% opacity.
```
Amazon:     hover:border-[#FF9900]/60 hover:shadow-[0_0_20px_#FF990015]
Etsy:       hover:border-[#F1641E]/60 hover:shadow-[0_0_20px_#F1641E15]
eBay:       hover:border-[#E53238]/60 hover:shadow-[0_0_20px_#E5323815]
Shopify:    hover:border-[#96BF48]/60 hover:shadow-[0_0_20px_#96BF4815]
WooCommerce:hover:border-[#7F54B3]/60 hover:shadow-[0_0_20px_#7F54B315]
TikTok Shop:hover:border-[#FF004F]/60 hover:shadow-[0_0_20px_#FF004F15]
```

When selected (toggled on), the card shows: `border-[platform-colour] bg-[platform-colour]/10`

#### Form Inputs
```
bg-surface-2 border border-border focus:border-accent focus:ring-1 focus:ring-accent/30
rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-disabled
text-base outline-none transition-colors duration-150
```

Never use white backgrounds on inputs — always `bg-surface-2`.

#### Tabs (Results screen)
```
Tab bar:     bg-surface border-b border-border
Active tab:  border-b-2 border-accent text-text-primary font-semibold
Inactive:    text-text-secondary hover:text-text-primary transition-colors
```

Platform tabs show a small coloured dot (the platform colour) to the left of the platform name.

#### Credit Badge (global, all authenticated pages)

Shown in the top navigation bar. Two-part display:
```
[violet dot] 43 monthly  ·  [grey dot] 100 top-up
```

Clicking it opens a dropdown with the full credit breakdown and a "Buy more" link. When credits drop to 5 or below, the monthly figure turns `text-warning`.

#### Loading / Generation States

- Per-platform spinner: a small `animate-spin` ring in the platform's accent colour, centred in the platform tab
- Skeleton loaders: use `bg-surface-2 animate-pulse rounded` bars — never use third-party skeleton libraries
- Copy button: on click, transitions from a clipboard icon to a checkmark (`text-success`) for 2 seconds, then resets
- "Analyse Image" button: shows a subtle progress bar beneath it while validation + extraction run

#### Generated Output Blocks

The listing output for each field (title, description, bullets, etc.) renders in a styled block:
```
bg-surface-2 border border-border rounded-lg p-4 font-mono text-sm text-text-primary
```

Each block has: the field label in `text-text-secondary text-xs uppercase tracking-widest` above it, the generated content in Geist Mono below, and a one-click copy icon (`ClipboardIcon` from lucide-react) in the top-right corner.

---

### Motion & Animation

Keep animations fast and purposeful. No decorative animations — every motion should communicate something (loading, success, transition).
```
Default transition:  duration-150 ease-out  (colour/border changes)
Page transitions:    duration-200 ease-out  (route changes via Next.js)
Modal/panel open:    duration-200 ease-out, slide up 8px + fade in
Generation spinner:  animate-spin, 1s linear
Skeleton pulse:      animate-pulse
Copy success flash:  200ms to checkmark, 2000ms hold, 200ms back
No bounce. No spring physics. No parallax. Speed and precision over delight.

Landing Page Specific
Hero section:
Full-width dark section (bg-base)
Headline uses a subtle gradient on key words: bg-gradient-to-r from-accent-light to-[#C084FC] bg-clip-text text-transparent applied to "every platform you sell on"
Platform logo row beneath the headline: small greyscale logos that gain colour on hover
CTA buttons side by side on desktop, stacked on mobile
Demo section:
Contained in a bg-surface border border-border rounded-2xl wrapper
Sample product cards: 3 cards in a horizontal row, each showing a product photo with a subtle hover lift (hover:-translate-y-1 transition-transform duration-150)
The partial Etsy output animates in with a fade — feels like watching the AI work
Testimonial cards:
bg-surface border border-border rounded-xl p-6
Quote in text-text-primary italic text-base
Name + platform in text-text-secondary text-sm
A small coloured platform badge (using platform colours) next to the seller's platform name
Section dividers:
No horizontal rules. Use py-24 spacing between sections only.
Subtle radial gradient blobs in the background (bg-accent at 4% opacity, blurred with blur-3xl) — gives depth without being distracting. One positioned top-right of hero, one bottom-left of demo section.

Iconography
Use Lucide React exclusively (lucide-react — already compatible with Next.js). No other icon libraries.
Key icons to use consistently:
Copy: ClipboardIcon → ClipboardCheckIcon on success
Platform generation: ZapIcon (fast, energetic)
Credits: CoinsIcon
Upload: UploadCloudIcon
Validation pass: ShieldCheckIcon
Error: AlertCircleIcon
Referral: UsersIcon
Settings: SlidersHorizontalIcon
TikTok: use the platform logo SVG (no Lucide equivalent) — inline SVG, coloured #FF004F
Icon size: w-4 h-4 inline with text, w-5 h-5 standalone, w-6 h-6 for feature illustrations.

Do Not
Do not use gradients on buttons — solid fills only
Do not use box shadows for depth — use borders and background colour differences instead
Do not use more than 2 font weights on the same screen
Do not use colour for decoration — every colour must mean something
Do not use rounded-full on anything except avatar circles and status dots
Do not add hover animations that take longer than 200ms
Do not centre-align body text blocks longer than 2 lines
Do not use off-white (#FAFAFA, #F5F5F5) backgrounds — the background is always #0A0A0F

DATABASE SCHEMA (Supabase)
Table: users
id: uuid (Clerk user ID)
email: string
stripe_customer_id: string
subscription_status: enum ('trial', 'starter', 'pro', 'cancelled')
billing_interval: enum ('monthly', 'annual') — default: 'monthly'
subscription_credits: integer (monthly allowance credits — default: 10 for trial)
topup_credits: integer (never-expiring credits from packs and referrals — default: 0)
preferred_platforms: text[] (persisted platform preferences, e.g. ['amazon', 'etsy', 'tiktok'])
brand_voice: text (optional, persisted per user, e.g. "friendly and minimal")
trial_started_at: timestamp
credits_reset_at: timestamp (date of last monthly credit refresh)
onboarding_email_sent: boolean (default: false — tracks whether Day 0 email has fired)
created_at: timestamp
Credit consumption logic (always enforce server-side in lib/credits.ts): Consume subscription_credits first. When subscription_credits reaches 0, consume topup_credits. Total available = subscription_credits + topup_credits. Never let either go below 0.
Table: listings
id: uuid
user_id: uuid (references users)
image_url: string
image_hash: string (SHA-256 hash of uploaded image — used for deduplication warning)
extracted_data: jsonb (user-confirmed product info — editable before generation)
platforms: text[] (platforms requested, e.g. ['amazon', 'etsy', 'ebay', 'tiktok'])
generated_listings: jsonb (keyed by platform: { amazon: {...}, etsy: {...}, tiktok: {...} })
prompt_version: string (e.g. "v1.0" — for A/B testing and iteration)
status: enum ('pending', 'confirming', 'generating', 'completed', 'failed')
credits_used: integer
created_at: timestamp
Table: topup_purchases
id: uuid
user_id: uuid (references users)
stripe_payment_intent_id: string
pack_name: string ('starter_pack', 'growth_pack', 'scale_pack')
credits_purchased: integer
amount_paid: integer (in pence)
created_at: timestamp
Table: referrals
id: uuid
referrer_user_id: uuid
referred_user_id: uuid
credits_awarded: boolean (default: false)
created_at: timestamp
Table: email_log
id: uuid
user_id: uuid (references users)
email_type: string ('welcome', 'day2_tip', 'day5_trial_nudge', 'day7_trial_expiry', 'credits_low')
sent_at: timestamp

CORE FEATURES
1. Landing Page (/) — Public
The landing page must do three things: demonstrate the product immediately, build trust, and convert to trial sign-up.
Hero section:
Headline: "Upload one photo. Get listings for every platform you sell on."
Subheadline: "Amazon, Etsy, eBay, Shopify, WooCommerce, and TikTok Shop — optimised copy in under 60 seconds."
Primary CTA: "Start your free trial" (→ /sign-up)
Secondary CTA: "See it in action" (→ scrolls to demo section)
Platform logos (Amazon, Etsy, eBay, Shopify, WooCommerce, TikTok Shop) displayed as trust/credibility row beneath headline
Demo section (no sign-up required): This is the single most important conversion element on the page. Allow visitors to experience the product before signing up.
Show 3 sample product photos the visitor can click (e.g. a ceramic mug, leather wallet, scented candle)
Alternatively, let them upload their own photo via a dropzone (no auth required, no credit deduction — use a server-side demo quota: max 50 demo runs/day total across all visitors)
Run Step 0 (validation) and Step 1 (extraction) on the selected/uploaded image
Show a partial result: the Etsy listing only (title + first 2 tags), visually styled as the real output would look
Gate the rest behind: "Sign up free to generate listings for all 6 platforms →"
This creates a genuine "aha moment" before any commitment
Social proof / testimonials section:
Display 3–5 seller testimonials with: photo, name, platform they sell on, quote
Pre-launch: recruit 10–15 beta testers (Etsy/Amazon/eBay sellers) via subreddits and Facebook groups — give them free access in exchange for a written quote before launch
Show real example outputs: a product photo alongside its generated Amazon title, Etsy description excerpt, TikTok Shop hook — real listings from real products, not lorem ipsum
Consider a "used by X sellers" counter once real data exists (start at 0, add when live)
How it works section: 3-step visual — Upload → Confirm → Copy
Pricing section: Abbreviated version of the pricing page (monthly/annual toggle), linking to /pricing for full detail
FAQ section: Address common objections — "Will Amazon flag AI-generated content?", "What if the AI gets the product details wrong?", "Do credits expire?"
2. Authentication
Clerk with Google OAuth
Protected routes: /dashboard, /generate, /listings, /account
Public routes: /, /pricing, /demo (if demo is a separate route)
On new sign-up: trigger Day 0 welcome email via Resend (see Email Sequence section)
3. Platform Selection — Step 1 of /generate
Show 6 platform toggle cards. Each card displays:
Platform logo + name
One-line description of what makes this platform's listings unique
Toggle on/off state
Platforms: Amazon, Etsy, eBay, Shopify, WooCommerce, TikTok Shop
Save selection to users.preferred_platforms on change — pre-selected on next visit. Minimum 1 platform required. Show credit cost preview before proceeding: "Generating for 4 platforms will use 4 credits. You have 47 subscription credits + 100 top-up credits remaining."
4. Image Upload — Step 2 of /generate
Dropzone (jpg, png, webp, max 5MB)
Upload to UploadThing, get URL
Compute SHA-256 hash of the image client-side before upload
Check hash against listings.image_hash for this user — if a match is found, show a soft warning: "You've generated listings for this product before. Continue to generate fresh copy, or view your previous listing." Do not block — user can proceed
Show image preview
"Analyse Image" button triggers the pipeline
5. AI Processing Pipeline
STEP 0: Image Validation (GPT-4o-mini) — runs before any credit deduction
Before extraction, validate that the uploaded image actually contains a product.
System prompt:
You are an image validation assistant for an e-commerce listing tool. Determine whether the uploaded image is suitable for generating a product listing.
User prompt:
Does this image contain a single, clearly identifiable physical product suitable for an e-commerce listing? Return ONLY valid JSON:
{
  "is_valid_product": boolean,
  "reason": "string — one sentence. If invalid, explain clearly."
}
If is_valid_product is false:
Do NOT proceed to extraction
Do NOT deduct any credits
Return the reason string to the UI as a friendly error message
UI copy: "We couldn't identify a product in this photo. Please upload a clear photo of a single item. No credits were used."
STEP 1: Vision Extraction (GPT-4o-mini)
Only reached if Step 0 passes.
System prompt:
You are a product data extraction assistant. Analyse product images and return structured JSON only. Never guess or fabricate. If a field cannot be determined from the image, return null for that field.
User prompt:
Analyse this product image and extract the following fields. Return ONLY valid JSON with no commentary.
{
  "product_type": "string — what the product is (e.g. ceramic mug, leather wallet)",
  "material": "string or null",
  "color": "string or null",
  "dimensions": "string or null — ONLY if clearly visible or printed on the product. Do NOT estimate from photos.",
  "style": "string or null — e.g. modern, vintage, minimalist, rustic",
  "key_features": ["array of 3-5 strings — only clearly observable features"],
  "condition": "string — New / Used / Handmade / Vintage",
  "suggested_category": "string or null"
}
CRITICAL: Never instruct the model to estimate dimensions from photos. Hallucinated dimensions destroy listing credibility and can get seller accounts flagged on Amazon and eBay.
STEP 2: Output Post-Processing Validation
After every GPT-4o generation call (for every platform), run the output through a post-processing validation function in lib/outputValidator.ts before storing or displaying the result. This is non-negotiable — raw model output should never be passed directly to the UI.
The validator must:
Parse JSON safely — catch any JSON parse errors and treat them as a platform failure (trigger credit refund for that platform)
Enforce character limits — truncate or flag fields that exceed platform limits:
Amazon title: 200 chars max
Etsy title: 140 chars max
eBay title: 80 chars max
Shopify title: 70 chars max
WooCommerce product_name: 65 chars max
TikTok Shop title: 90 chars max
All meta descriptions: enforced per platform spec
Strip markdown artefacts — remove **, ##, *, `, _ from all string fields. Generated text must be plain copy-paste ready
Null-check required fields — if a required field (title, description) is an empty string or whitespace-only, replace with null and treat as a partial platform failure
Remove fabricated dimensions — if dimensions is present in the output but was null in the confirmed extraction data, strip it from the output silently
Log validation failures — log any field that was truncated or stripped to the server console for monitoring
typescript
// lib/outputValidator.ts
export function validatePlatformOutput(platform: Platform, raw: unknown): ValidatedOutput | null
```

Return `null` if the output is unrecoverable (missing title + description). Return the cleaned `ValidatedOutput` object otherwise.

#### STEP 3: User Confirmation Screen — Step 3 of /generate (NON-OPTIONAL)

Before generating any listings, show the extracted data in an editable form:

* Product type (text input)
* Material (text input)
* Color (text input)
* Dimensions (text input — labelled "Leave blank if unknown. Never guess.")
* Style (text input)
* Key features (editable tag list — user can add/remove)
* Condition (dropdown: New / Used / Handmade / Vintage)
* Target audience (text input — user-specified, not AI-guessed)
* Brand voice (text input — persisted to user profile on save)
* Platform selection (review/change from Step 1)
* Credit cost reminder: *"This will use X credits (Y subscription + Z top-up remaining)"*

#### STEP 4: Platform-Specific Generation (GPT-4o) — Step 4 of /generate

Run one API call per selected platform **in parallel using Promise.all** — never sequentially. If one platform fails, others still complete and return. Only deduct credits for platforms that successfully complete. All output passes through `validatePlatformOutput()` before use.

**Error state UX — per-platform failure message (shown in the results tab for any failed platform):**
> *"Something went wrong generating your [Platform] listing — your credit has been refunded. Try regenerating this platform."*

Show a "Retry" button that costs 1 credit and confirms before proceeding.

System prompt for all platforms:
```
You are an expert e-commerce copywriter specialising in platform-specific product listings. You write listings that rank well and convert browsers into buyers. Follow the exact structure and character limits specified. Return only valid JSON. Do not use markdown formatting in any field — all text must be plain and copy-paste ready.

AMAZON PROMPT:
Create an Amazon product listing. Prioritise keyword-rich, factual language. No promotional claims (best, #1, amazing, etc.). Amazon uses AI detection to monitor listings — never fabricate specs, dimensions, or claims that cannot be verified from the product data provided.
Product data: {extracted_data_json} Brand voice: {brand_voice}
Return JSON:
json
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
}
Amazon UI warning — display this beneath the Amazon output tab, always:
⚠️ Review before publishing. Amazon monitors AI-generated content and may flag listings with unverified specs or exaggerated claims. Ensure all dimensions and features are accurate before going live.

ETSY PROMPT:
Create an Etsy product listing. Etsy buyers respond to story, craft, and occasion. Lead with emotion and discovery.
Product data: {extracted_data_json} Brand voice: {brand_voice}
Return JSON:
json
{
  "title": "max 140 chars — what it is + material + occasion or recipient + one emotional hook. No generic filler words.",
  "description": "Structure: (1) Opening hook paragraph. (2) 'Why You'll Love It' section. (3) 'Materials & Dimensions' section — omit dimensions if unconfirmed. (4) 'Perfect As A Gift For' section. (5) Shipping/personalisation note. (6) Closing CTA.",
  "tags": ["13 tags, max 20 chars each — mix of product type, material, occasion, style, recipient type, season. No single generic words."]
}

EBAY PROMPT:
Create an eBay product listing. eBay buyers are value-conscious and detail-oriented. Modern eBay search penalises keyword stuffing — write clean, factual listings. Do NOT use ALL CAPS or power words like RARE or FAST SHIPPING in titles.
Product data: {extracted_data_json} Brand voice: {brand_voice}
Return JSON:
json
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
}

SHOPIFY PROMPT:
Create a Shopify product listing for a brand-owned store. Optimise for brand voice and Google Shopping.
Product data: {extracted_data_json} Brand voice: {brand_voice}
Return JSON:
json
{
  "title": "max 70 chars — product type + key descriptor + material/color",
  "description_html": "Valid HTML only. No markdown. Structure: <p> opening hook </p>, <ul> Key Features list </ul>, Specifications as <table> or <ul>, <p> Why You'll Love It emotional paragraph </p>, <p> Perfect For use cases </p>, <p> care/shipping note </p>",
  "meta_description": "max 320 chars — primary keyword + value proposition + click motivator",
  "alt_text": "max 125 chars — product type + colour + material",
  "product_type": "Shopify product category suggestion",
  "tags": "comma-separated — style, material, use case, target audience, season/occasion. Max 250 chars total."
}

WOOCOMMERCE PROMPT:
Create a WooCommerce product listing. Optimise for Yoast/Rank Math SEO. Balance keyword density with natural readability.
Product data: {extracted_data_json} Brand voice: {brand_voice}
Return JSON:
json
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
}

TIKTOK SHOP PROMPT:
TikTok Shop is a high-growth marketplace (especially in the UK) with a completely different buyer psychology to all other platforms. Buyers discover products through short-form video content — listings must lead with scroll-stopping hooks, social proof language, and urgency. The writing style is punchy, conversational, and trend-aware. Titles should read like a video hook. Descriptions should feel like a creator talking directly to camera. Keywords matter but don't keyword-stuff — TikTok Shop's search algorithm rewards engagement signals as much as keyword density.
Product data: {extracted_data_json} Brand voice: {brand_voice}
Return JSON:
json
{
  "title": "max 90 chars — lead with the strongest benefit or hook, not the product name. Conversational, scroll-stopping. No ALL CAPS. E.g. 'The ceramic mug that actually keeps your coffee hot for 4 hours'",
  "description": "Structure: (1) Hook sentence — one line that would stop a scroll. (2) 'Why everyone's buying this' — 2-3 social proof style sentences. (3) Key product details as short punchy lines (no bullet points — write as flowing short sentences). (4) 'Perfect if you...' use-case section. (5) Urgency/scarcity line if applicable (only if genuine). (6) CTA: 'Tap Add to Cart before it sells out' or similar.",
  "hashtags": ["8-12 hashtags — mix of: product-specific (#ceramicmug), niche community (#coffeelover), trending shopping tags (#TikTokMadeMeBuyIt #ShopTikTok), and broad discovery (#smallbusiness #homedecor). No spaces in hashtags."],
  "short_video_hook": "One punchy opening line (max 15 words) designed to be spoken in a TikTok video about this product. E.g. 'POV: you finally found a mug that keeps your coffee hot all morning'",
  "key_selling_points": ["3-5 bullet points — each max 10 words. Ultra-concise. For use in video overlays or pinned comments."]
}

6. Results Display — Step 5 of /generate
Platform tabs — only show tabs for selected platforms
Each tab: all fields displayed clearly with one-click copy per field
"Copy All" button — copies a formatted plaintext version of the full listing
"Regenerate this platform" button — costs 1 credit, confirms before proceeding, shows updated credit balance after
Per-platform loading spinners (not a single global spinner — parallel generation means some finish before others)
Error state per platform: if a platform fails, show the tab with the error message: "Something went wrong generating your [Platform] listing — your credit has been refunded. [Retry button]"
Auto-save to database on generation completion
Show updated credit balance (subscription + top-up) after generation completes
Post-generation referral prompt: beneath the results, show: "Your listings are ready! Know another seller who'd love this? Share ListListList and earn 10 free credits → [referral link]"
Amazon tab: always display the AI content warning beneath the output (see Amazon prompt section above)
7. Dashboard (/dashboard)
Credit balance displayed as two figures: "43 monthly credits + 100 top-up credits" with a "Buy more" link
Active plan badge (shows "Trial — X days remaining" for trial users with urgency colouring when ≤2 days left)
Grid of previous listings: thumbnail, platforms generated, date, status
Click any listing to view full generated output
"New Listing" CTA
Referral widget: unique referral link + credits earned from referrals + "Earn 10 credits for every seller you refer"
"Bulk upload — coming soon" banner for Starter users; "Bulk upload — coming soon" badge on Pro tier (not built yet — placeholder only)
8. Pricing Page (/pricing)
Include a monthly/annual billing toggle at the top. Default to monthly. When annual is selected, all prices update and show the saving.
Subscription tiers:


Free Trial
Starter
Pro
Price (monthly)
7 days free
£39/month
£79/month
Price (annual)
—
£390/year (save £78)
£790/year (save £158)
Trial credits
10
—
—
Monthly credits
—
50
1,000
Rollover cap
—
100
2,000
Platforms
All 6 (inc. TikTok Shop)
All 6
All 6
Bulk upload
—
—
Coming soon
Priority generation
—
—
✓

Top-up credit packs (shown below tier cards and on account page):
Pack
Credits
Price
Note
Starter pack
100 credits
£14
Credits never expire
Growth pack
300 credits
£35
Credits never expire
Scale pack
700 credits
£70
Credits never expire

Show clearly: "Top-up credits never expire and are used after your monthly credits."
9. Account Page (/account)
Manage subscription via Stripe Customer Portal link (handles both monthly and annual)
Credit breakdown: "43 monthly credits (resets 14 April) + 100 top-up credits (never expire)"
Progress bar showing monthly credit usage vs allowance
Buy top-up credits section (same three packs)
Preferred platforms setting (including TikTok Shop)
Saved brand voice text
Billing history (subscriptions + one-time top-up purchases)
Referral link + credits earned

EMAIL SEQUENCE (Resend)
Implement a 4-email automated sequence triggered by user signup. All emails sent via Resend. Log each send to the email_log table to prevent duplicate sends. Use Supabase scheduled functions or a Vercel cron job to check and dispatch pending emails daily.
All emails must include the user's credit balance in the footer: "You have X credits remaining in your trial."
Day 0 — Welcome (trigger: immediately on sign-up)
Subject: "You're in — here's how to get your first listing in 3 minutes"
Body:
Welcome + what ListListList does in 2 sentences
Single CTA: "Generate your first listing →" (→ /generate)
Quick tip: "Tip: a clean, well-lit photo on a plain background gives the best results"
Credit balance reminder: "You have 10 credits to use in your 7-day trial — that's up to 10 platform listings."
Day 2 — Feature tip (trigger: 48 hours after sign-up, if user has not yet generated a listing)
Subject: "A tip most sellers miss on their first listing"
Body:
Short tip: explain that filling in "Target Audience" and "Brand Voice" on the confirmation screen makes a significant difference to output quality
One example: before/after excerpt showing generic vs brand-voice-aware Etsy description
CTA: "Try it now →" (→ /generate)
Reminder of credits remaining
Day 5 — Trial nudge (trigger: 5 days after sign-up, if user has not yet subscribed)
Subject: "2 days left in your trial — don't lose your listings"
Body:
Urgency: trial ends in 2 days
Reminder: all listings generated during trial remain accessible after subscribing
Show the pricing options briefly: Starter £39/mo or Pro £79/mo
CTA: "Upgrade now and keep everything →" (→ /pricing)
Secondary CTA: "Generate one more listing before your trial ends →" (→ /generate)
Day 7 — Trial expiry (trigger: on trial expiry, if user has not yet subscribed)
Subject: "Your ListListList trial has ended"
Body:
Confirm trial has ended — they can no longer generate listings
Their saved listings are still accessible in the dashboard
Invite them back: "Whenever you're ready, pick a plan and carry on where you left off."
CTA: "Choose a plan →" (→ /pricing)
Include referral offer: "Not ready yet? Refer a friend and earn 10 free credits when they subscribe."
Ongoing — Low credits alert (trigger: when total credits drop to 5 or below)
Subject: "You're running low on credits"
Body:
"You have X credits left this month."
Options: upgrade plan, buy a top-up pack, or wait for renewal date
CTA: "Buy more credits →" (→ /account)
Implementation note: Check onboarding_email_sent flag before sending Day 0 to prevent double-sends on re-auth. Use email_log to track all sends. Never send more than one email per type per user.

API ROUTES
POST /api/demo
Input: { imageUrl?: string, sampleProduct?: 'mug' | 'wallet' | 'candle' }
No auth required — rate limited by IP (max 10 demo runs per IP per day; max 50 total per day via env-var controlled counter in Supabase)
Runs Step 0 (validation) + Step 1 (extraction) only — no generation, no credit deduction
Returns Etsy listing only via GPT-4o-mini (cheaper, sufficient for demo): { etsy_preview: { title: string, tags: string[] } }
Logs demo usage to a demo_runs table (ip_hash, created_at) for rate limiting
POST /api/validate
Input: { imageUrl: string }
Calls GPT-4o-mini with image validation prompt (Step 0)
Returns: { is_valid_product: boolean, reason: string }
Does NOT deduct credits
Rate limit: 20 requests/minute per user
POST /api/extract
Input: { imageUrl: string }
Only called after /api/validate returns is_valid_product: true
Calls GPT-4o-mini with vision extraction prompt
Returns: { extracted_data: ExtractedProduct }
Does NOT deduct credits
Rate limit: 20 requests/minute per user
POST /api/generate
Input: { imageUrl, extractedData, platforms[], brandVoice? }
Validates total available credits (subscription_credits + topup_credits >= platforms.length)
Deducts credits atomically via Supabase RPC before generation begins
Runs GPT-4o calls in parallel: Promise.all(platforms.map(p => generateForPlatform(p)))
Each platform output passes through validatePlatformOutput() before use
On partial failure: refund credits for failed platforms via RPC; return error state per platform to UI
Saves completed listings to database
Returns: { listings: Record<Platform, GeneratedListing | null>, failedPlatforms: Platform[], errors: Record<Platform, string>, subscriptionCreditsRemaining: number, topupCreditsRemaining: number }
Rate limit: 10 requests/minute per user
POST /api/topup
Input: { packId: 'starter_pack' | 'growth_pack' | 'scale_pack' }
Creates a Stripe Checkout session in payment mode for the selected pack
Returns: { checkoutUrl: string }
GET /api/credits
Returns { subscriptionCredits, topupCredits, totalCredits, plan, billingInterval, creditsResetAt, rolloverCap }
GET /api/listings
Returns paginated user listings (10 per page, offset pagination)
Includes thumbnail URL, platforms, status, created_at
POST /api/webhooks/stripe
Handles the following events:
checkout.session.completed (mode: subscription) → update subscription_status, billing_interval, set subscription_credits per plan, set credits_reset_at
checkout.session.completed (mode: payment) → add credits to topup_credits, insert row in topup_purchases
customer.subscription.updated → update subscription_status, billing_interval, and monthly allowance
customer.subscription.deleted → set subscription_status to 'cancelled', zero out subscription_credits
invoice.paid (monthly/annual renewal) → run rollover logic: subscription_credits = MIN(subscription_credits + monthly_allowance, rollover_cap)

SUPABASE RPC FUNCTIONS
deduct_credits(user_id, amount)
sql
-- Deduct from subscription_credits first, overflow to topup_credits
-- Raises exception if total credits insufficient
-- Returns new { subscription_credits, topup_credits }
refund_credits(user_id, amount)
sql
-- Refund credits after partial generation failure
-- Adds back to subscription_credits first (up to rollover cap),
-- otherwise adds back to topup_credits
apply_monthly_rollover(user_id, monthly_allowance, rollover_cap)
sql
-- Called on invoice.paid webhook
-- subscription_credits = LEAST(subscription_credits + monthly_allowance, rollover_cap)

PROMPT VERSIONING
Store the prompt version string in listings.prompt_version on every generation.
In lib/prompts.ts:
typescript
export const PROMPT_VERSION = "v1.0"
```

Use this to compare output quality across prompt iterations, run A/B tests, and identify which version produces fewer regeneration requests.

---

## FILE STRUCTURE
```
app/
  (auth)/
    sign-in/[[...sign-in]]/page.tsx
    sign-up/[[...sign-up]]/page.tsx
  api/
    demo/route.ts
    validate/route.ts
    extract/route.ts
    generate/route.ts
    topup/route.ts
    listings/route.ts
    credits/route.ts
    webhooks/stripe/route.ts
  dashboard/page.tsx
  generate/page.tsx        ← multi-step: platform select → upload → validate → confirm → results
  pricing/page.tsx
  account/page.tsx
  layout.tsx
  page.tsx (landing — includes demo section)
components/
  platform-toggle-card.tsx
  upload-dropzone.tsx
  extraction-confirm-form.tsx
  listing-result-tabs.tsx
  platform-error-state.tsx  ← per-platform failure UI with retry button
  copy-button.tsx
  credit-badge.tsx          ← shows subscription + topup split
  topup-pack-card.tsx
  pricing-card.tsx
  referral-widget.tsx
  demo-section.tsx          ← landing page demo (no auth)
  testimonial-card.tsx      ← landing page social proof
  billing-toggle.tsx        ← monthly/annual pricing toggle
lib/
  db.ts
  openai.ts                ← separate instances for gpt-4o-mini vs gpt-4o
  stripe.ts
  resend.ts                ← email sending via Resend
  prompts.ts               ← all prompts + PROMPT_VERSION constant
  credits.ts               ← all credit logic: deduct, refund, rollover, total available
  outputValidator.ts       ← post-processing: strip markdown, enforce char limits, null-check
  imageHash.ts             ← SHA-256 image hashing for deduplication
types/
  index.ts                 ← Platform, ExtractedProduct, GeneratedListing, Listing, User, TopupPack
```

---

## ENVIRONMENT VARIABLES
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

UPLOADTHING_TOKEN=

OPENAI_API_KEY=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID=
NEXT_PUBLIC_STRIPE_STARTER_ANNUAL_PRICE_ID=
NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID=
NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID=
NEXT_PUBLIC_STRIPE_TOPUP_STARTER_PRICE_ID=
NEXT_PUBLIC_STRIPE_TOPUP_GROWTH_PRICE_ID=
NEXT_PUBLIC_STRIPE_TOPUP_SCALE_PRICE_ID=

RESEND_API_KEY=

DEMO_DAILY_QUOTA=50

TECHNICAL REQUIREMENTS
React Server Components where possible; Client Components only for interactive steps
Multi-step generate flow managed with useReducer on the client
Parallel platform generation via Promise.all — never sequential
All credit operations go through lib/credits.ts — never write ad-hoc credit deduction inline
Credit deduction and refund via Supabase RPC transactions — atomic, prevents double-spend
All generated output passes through lib/outputValidator.ts before being stored or displayed
Zod validation on all API route inputs
Per-platform error handling — partial success beats full failure; refund credits for failed platforms; display per-platform error state with retry
Per-platform loading spinners in results (not a single global spinner)
Copy buttons use Clipboard API with textarea fallback for older browsers
Mobile-responsive throughout
All generated text is copy-paste ready — no markdown artefacts in JSON output (enforced by outputValidator)
Credit balance (subscription + top-up split) visible on every authenticated page via the credit-badge component
Email sequence implemented via Resend + Supabase email_log table — no duplicate sends
Image deduplication: hash image client-side, warn user if previously generated for this product
Annual and monthly billing both supported from day one — billing_interval tracked in DB and reflected in Stripe webhook handling

PLATFORM CHEATSHEET
Platform
Buyer Mindset
Key Priority
Amazon
Search and compare
Keyword density, factual bullets, no AI-flaggable claims
Etsy
Discover and gift
Story, emotion, 13 searchable tags
eBay
Value and condition
Condition clarity, honest specs, clean title
Shopify
Brand experience
Brand voice, rich HTML, Google SEO
WooCommerce
SEO and control
Yoast-optimised, full HTML flexibility
TikTok Shop
Discover via video
Hook-first copy, hashtags, short video hook line


BUILD ORDER
Work through these one at a time. Prompt your AI IDE with: "Using our project rules, implement Step [N]." Test each step end-to-end before moving to the next.
Database schema and Supabase setup — including all three RPC functions (deduct, refund, rollover), email_log table, demo_runs table, billing_interval column, image_hash column, onboarding_email_sent column
Clerk auth and protected routes
Stripe products, pricing page, webhooks — both subscription (monthly + annual) and one-time payment modes; billing toggle on pricing page
Image upload via UploadThing + client-side SHA-256 image hashing + deduplication warning
Image validation API route (Step 0) and error UI
Vision extraction API route and confirmation UI
lib/outputValidator.ts — build and unit test the post-processing validator before building generation
Platform generation API route — build for one platform first, then parallelise; include partial failure handling, credit refund, and per-platform error state UI
Add TikTok Shop as the 6th platform throughout the generate flow, results display, and platform cheatsheet
Results display with copy buttons, per-platform error states, updated credit balance, and post-generation referral prompt
Dashboard and listings history
Landing page — hero, demo section (no auth), social proof/testimonials, how it works, pricing preview, FAQ
Top-up pack purchasing flow (Stripe payment mode + webhook)
Account page: credit breakdown, billing interval display, top-up section, Stripe Customer Portal
Rollover logic on invoice.paid webhook
Email sequence via Resend: Day 0, Day 2, Day 5, Day 7, low-credit alert — with email_log deduplication
Referral system
Polish: loading states, mobile layout, Amazon AI warning, "Bulk upload — coming soon" placeholders, trial expiry countdown in dashboard
Specifically stress-test: credit deduction on concurrent requests, partial generation failures and refunds, rollover cap enforcement, top-up credit ordering (subscription first, top-up second), annual vs monthly webhook handling, and demo route rate limiting.

SUCCESS CRITERIA
Landing page demo works without sign-up — visitor sees a partial Etsy result for a sample or uploaded product
Invalid images are rejected before any credits are deducted, with a clear user-friendly message
User uploads photo → confirms product data → selects platforms → receives all listings in under 45 seconds
All generated output passes through post-processing validation — no markdown artefacts, no truncated-over-limit titles, no fabricated dimensions
Per-platform error states display correctly: failed platforms show the error message with refund confirmation and retry button
Credits deducted correctly per platform — subscription credits consumed before top-up credits
Partial generation failures trigger automatic credit refunds for failed platforms only
Monthly rollover applies correctly and never exceeds the plan cap
Annual billing price IDs handled correctly in Stripe webhook — billing_interval stored accurately
Top-up credits purchased via Stripe appear in the account instantly after webhook
Top-up credits are never zeroed on subscription renewal or cancellation
Stripe subscription activates within 5 seconds of payment
Email sequence fires correctly — Day 0 on sign-up, Day 2 if no listing generated, Day 5 if not subscribed, Day 7 on trial expiry — no duplicates
TikTok Shop listings generate correctly with hook-first copy, hashtags, and short video hook field
Amazon tab always displays the AI content warning beneath the output
Listings persist and are viewable from dashboard
All copy buttons work reliably across browsers
Platform preferences (including TikTok Shop) saved and pre-selected on next visit
"Bulk upload — coming soon" placeholder visible for Pro users — no bulk upload functionality built
Prompt version recorded on every generation

That's the full updated prompt. Before I save this to Google Drive to replace the God Prompt document, confirm you're happy with it and let me know if anything needs adjusting.
Updated todo list with God Prompt improvements and tracking
Updated todo list with God Prompt improvements and tracking
Here's a summary of every change made and where it lands:
Trial credits — bumped from 5 to 10 throughout (schema default, pricing table, email sequence, success criteria).
TikTok Shop — added as a full 6th platform everywhere: platform toggle, generation prompt (with its own hook-first copy structure, hashtags, and short_video_hook field), results tabs, platform cheatsheet, pricing table, preferred_platforms schema, landing page subheadline, and success criteria.
Annual billing — billing_interval column added to schema, separate Stripe price IDs for monthly/annual in env vars, billing toggle on pricing page, annual prices in the pricing table, webhook handling updated, account page updated.
Demo mode — full /api/demo route spec added, demo_runs table in schema, demo-section.tsx component in file structure, landing page section fully described, IP rate limiting and daily quota via env var.
Email sequence — full 5-email spec (Day 0, Day 2, Day 5, Day 7, low-credit alert), Resend added to tech stack and env vars, email_log table in schema, onboarding_email_sent flag, resend.ts added to lib, Step 16 in build order.
Output post-processing validator — lib/outputValidator.ts fully specced (JSON parse safety, character limits for all 6 platforms, markdown stripping, null-check, dimension stripping), called explicitly in generate route, Step 7 in build order, requirement #6 in technical requirements.
Amazon AI warning — permanent UI warning specified beneath the Amazon tab, referenced in success criteria.
Bulk upload — formally deferred with "coming soon" placeholder in Pro card, dashboard, and build order Step 18. No implementation.
Error state UX — exact copy specified ("Something went wrong generating your [Platform] listing — your credit has been refunded"), platform-error-state.tsx component added to file structure, retry button with 1-credit confirmation described.
Social proof / testimonials — full landing page section specced with pre-launch beta tester recruitment strategy, testimonial-card.tsx in file structure, real example outputs described.
Image deduplication — SHA-256 hashing added to upload step, image_hash column in schema, imageHash.ts in lib, soft warning UI described.
Referral surfacing — link now appears in dashboard widget, account page, post-generation results screen, and Day 7 email — not just buried in settings.

