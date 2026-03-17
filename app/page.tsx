import Link from 'next/link'
import { UploadCloudIcon, CheckCircleIcon, ClipboardIcon, ChevronRightIcon } from 'lucide-react'
import DemoSection from '@/components/demo-section'
import PricingPreview from '@/app/pricing-preview'
import PlatformRow from '@/components/platform-row'

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav className="border-b border-border bg-white sticky top-0 z-50">
      <div className="max-w-content mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/">
          <img src="/logo.svg" alt="listlistlist" style={{ height: '40px', width: 'auto' }} />
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/pricing"
            className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors duration-150"
          >
            Pricing
          </Link>
          <Link
            href="/sign-in"
            className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors duration-150"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="ml-2 inline-flex items-center gap-1.5 bg-[#1A1814] hover:bg-[#2D2A25] text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors duration-150"
          >
            Start free trial
          </Link>
        </div>
      </div>
    </nav>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="bg-base py-24 sm:py-32">
      <div className="max-w-content mx-auto px-6 text-center space-y-8">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-white text-xs text-text-secondary font-medium shadow-card">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          7-day free trial — no credit card required
        </div>

        {/* Headline */}
        <h1 className="text-[48px] font-medium tracking-tight text-text-primary leading-[1.1] max-w-3xl mx-auto">
          Upload one photo.
          <br className="hidden sm:block" />
          Get listings for every platform you sell on.
        </h1>

        {/* Subheadline */}
        <p className="text-xl text-text-secondary max-w-[540px] mx-auto leading-relaxed">
          Amazon, Etsy, eBay, Shopify, WooCommerce, and TikTok Shop — optimised copy in under 60 seconds.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-[#1A1814] hover:bg-[#2D2A25] text-white font-medium px-6 py-3 rounded-lg text-base transition-colors duration-150"
          >
            Start your free trial
          </Link>
          <a
            href="#demo"
            className="inline-flex items-center gap-2 border border-border bg-white hover:bg-surface-2 text-text-primary font-medium px-6 py-3 rounded-lg text-base transition-colors duration-150 shadow-card"
          >
            See it in action
            <ChevronRightIcon className="w-4 h-4" />
          </a>
        </div>

        {/* Platform row */}
        <div className="pt-6">
          <p className="text-xs text-text-disabled mb-5 uppercase tracking-widest font-medium">
            Generates listings for
          </p>
          <PlatformRow />
        </div>
      </div>
    </section>
  )
}

// ─── Demo section ─────────────────────────────────────────────────────────────

function DemoWrapper() {
  return (
    <section id="demo" className="py-20 bg-surface-2">
      <div className="max-w-3xl mx-auto px-6 space-y-10">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-medium tracking-tight text-text-primary">
            See it before you sign up
          </h2>
          <p className="text-text-secondary">
            Pick a product or upload your own. No account needed.
          </p>
        </div>
        <DemoSection />
      </div>
    </section>
  )
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote: "I used to spend 45 minutes writing each Amazon listing. Now it takes me 90 seconds. The keyword structure it generates is genuinely better than what I was doing manually.",
    name:  'Sarah K.',
    role:  'Amazon seller · Home & Kitchen',
    platform: 'Amazon',
    color:    '#FF9900',
  },
  {
    quote: "The Etsy descriptions it writes actually sound like me. I added my brand voice and it picked it up perfectly. My conversion rate went up 18% the first month I used it.",
    name:  'Marcus T.',
    role:  'Etsy seller · Handmade jewellery',
    platform: 'Etsy',
    color:    '#F1641E',
  },
  {
    quote: "I sell on four platforms. Before this I'd just copy-paste the same description everywhere. Now each platform gets copy that actually fits how buyers search there.",
    name:  'Priya M.',
    role:  'Multi-platform seller',
    platform: 'eBay',
    color:    '#E53238',
  },
]

function Testimonials() {
  return (
    <section className="py-20 bg-surface-2">
      <div className="max-w-content mx-auto px-6 space-y-12">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-medium tracking-tight" style={{ color: '#1A1814' }}>
            Sellers are saving hours every week
          </h2>
          <p style={{ color: '#6B6760' }}>
            Beta testers across platforms report consistent time savings from day one.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="border border-border rounded-xl p-6 space-y-4 shadow-card"
              style={{ backgroundColor: '#FFFFFF' }}
            >
              <p
                className="font-normal text-base leading-relaxed"
                style={{ color: '#1A1814' }}
              >
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#1A1814' }}>{t.name}</p>
                  <p className="text-sm" style={{ color: '#6B6760' }}>{t.role}</p>
                </div>
                <span
                  className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium"
                  style={{ background: `${t.color}18`, color: t.color }}
                >
                  {t.platform}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    number: '01',
    Icon:   UploadCloudIcon,
    title:  'Upload a photo',
    body:   'Drop in a product photo — JPG, PNG or WebP, up to 4 MB. A clean shot on a plain background works best.',
  },
  {
    number: '02',
    Icon:   CheckCircleIcon,
    title:  'Confirm the details',
    body:   'The AI extracts product details automatically. Review and edit anything before generating — no credits used until you confirm.',
  },
  {
    number: '03',
    Icon:   ClipboardIcon,
    title:  'Copy and publish',
    body:   'Each platform gets its own optimised listing. Copy any field with one click — or grab the whole listing at once.',
  },
]

function HowItWorks() {
  return (
    <section className="py-20 bg-base">
      <div className="max-w-content mx-auto px-6 space-y-12">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-medium tracking-tight text-text-primary">
            How it works
          </h2>
          <p className="text-text-secondary">Three steps. Under 60 seconds.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:items-start">
          {STEPS.map((step, i) => (
            <div key={step.number} className="relative flex flex-col gap-4">
              {/* Connector line — absolute so it doesn't affect flex layout */}
              {i < STEPS.length - 1 && (
                <div
                  aria-hidden
                  className="hidden md:block absolute h-px bg-border"
                  style={{ left: '44px', right: 0, top: '22px' }}
                />
              )}

              {/* Icon row — always starts at the very top of each column */}
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-11 h-11 rounded-xl bg-accent-light border border-accent/20 flex items-center justify-center flex-shrink-0">
                  <step.Icon className="w-5 h-5 text-accent" />
                </div>
                <span className="text-xs font-mono text-text-disabled">{step.number}</span>
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-medium text-text-primary">{step.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'Will Amazon flag AI-generated listings?',
    a: "Amazon monitors listings for fabricated specs and promotional language — not AI assistance per se. listlistlist is built around this: it never invents dimensions or unverified claims, and it avoids the phrases Amazon flags. You still need to review before publishing, and we show a reminder on every Amazon result.",
  },
  {
    q: "What if the AI gets the product details wrong?",
    a: "You always see and edit the extracted details before any listing is generated. If the AI misidentifies the material or colour, fix it on the confirmation screen. Nothing is generated — and no credits are used — until you approve the details.",
  },
  {
    q: 'Do credits expire?',
    a: "Monthly subscription credits roll over to the next month up to your plan cap (100 for Starter, 2,000 for Pro). Top-up credits from one-time purchases never expire. Credits from referrals also never expire.",
  },
  {
    q: 'Can I generate listings for just one platform?',
    a: 'Yes — you choose which platforms to generate for before each upload. Each platform costs 1 credit. If you only want an Etsy listing, that costs 1 credit. Add Amazon and it costs 2.',
  },
  {
    q: 'What image formats and sizes are supported?',
    a: 'JPG, PNG, and WebP files up to 4 MB. A well-lit product photo on a plain or simple background gives the best AI extraction results.',
  },
  {
    q: 'Can I cancel my subscription?',
    a: "Yes, anytime from your account page. Your access continues until the end of the billing period. All your generated listings remain visible in your dashboard after cancellation.",
  },
]

import FaqAccordion from '@/app/faq-accordion'

function FaqSection() {
  return (
    <section className="py-20 bg-base">
      <div className="max-w-2xl mx-auto px-6 space-y-10">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-medium tracking-tight text-text-primary">
            Common questions
          </h2>
        </div>
        <FaqAccordion items={FAQS} />
      </div>
    </section>
  )
}

// ─── Bottom CTA ───────────────────────────────────────────────────────────────

function BottomCta() {
  return (
    <section className="py-20 bg-surface-2">
      <div className="max-w-xl mx-auto px-6 text-center space-y-6">
        <h2 className="text-4xl font-medium tracking-tight text-text-primary">
          Stop writing listings by hand.
        </h2>
        <p className="text-text-secondary text-lg">
          10 credits free. No credit card. Cancel anytime.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-[#1A1814] hover:bg-[#2D2A25] text-white font-medium px-8 py-3.5 rounded-lg text-base transition-colors duration-150"
          >
            Start your free trial
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 border border-border bg-white hover:bg-surface-2 text-text-primary font-medium px-6 py-3.5 rounded-lg text-base transition-colors duration-150 shadow-card"
          >
            See full pricing
          </Link>
        </div>
        <p className="text-xs text-text-disabled">
          7 days free · 10 credits included · No credit card required
        </p>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-border bg-surface-2 py-8">
      <div className="max-w-content mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-disabled">
        <Link href="/">
          <img src="/logo.svg" alt="listlistlist" style={{ height: '28px', width: 'auto', opacity: 0.5 }} />
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/pricing" className="hover:text-text-secondary transition-colors">Pricing</Link>
          <Link href="/sign-in" className="hover:text-text-secondary transition-colors">Sign in</Link>
          <Link href="/sign-up" className="hover:text-text-secondary transition-colors">Start free trial</Link>
        </div>
        <span>© {new Date().getFullYear()} listlistlist</span>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="bg-base">
      <Nav />
      <Hero />
      <DemoWrapper />
      <Testimonials />
      <HowItWorks />

      {/* Pricing preview */}
      <section className="py-20 bg-surface-2">
        <div className="max-w-content mx-auto px-6 space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-medium tracking-tight text-text-primary">
              Simple, transparent pricing
            </h2>
            <p className="text-text-secondary">
              Start free. Upgrade when you&apos;re ready.
            </p>
          </div>
          <PricingPreview />
          <div className="text-center">
            <Link
              href="/pricing"
              className="text-sm text-accent hover:text-accent-hover transition-colors duration-150"
            >
              See full pricing including top-up packs →
            </Link>
          </div>
        </div>
      </section>

      <FaqSection />
      <BottomCta />
      <Footer />
    </div>
  )
}
