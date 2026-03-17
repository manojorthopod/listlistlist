'use client'

import { useReducer, useCallback, useRef, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { ZapIcon, CoinsIcon } from 'lucide-react'
import { UploadDropzone, type UploadedImage } from '@/components/upload-dropzone'
import { ImageValidator } from '@/components/image-validator'
import { ExtractionConfirmForm } from '@/components/extraction-confirm-form'
import PlatformToggleCard from '@/components/platform-toggle-card'
import ListingResultTabs, { type PlatformStateMap } from '@/components/listing-result-tabs'
import CreditBadge from '@/components/credit-badge'
import type {
  Platform,
  ExtractedProduct,
  GeneratedListings,
  GenerateResponse,
} from '@/types'

const ALL_PLATFORMS: Platform[] = ['amazon', 'etsy', 'ebay', 'shopify', 'woocommerce', 'tiktok']

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Step =
  | 'platforms'   // Step 1 — choose platforms
  | 'upload'      // Step 2 — upload image
  | 'validate'    // Step 3 — image validation + extraction (auto)
  | 'confirm'     // Step 4 — review/edit extraction
  | 'results'     // Step 5 — generated results

interface State {
  step:                Step
  selectedPlatforms:   Platform[]
  uploadedImage:       UploadedImage | null
  extractedData:       ExtractedProduct | null
  extracting:          boolean
  extractError:        string | null
  platformState:       PlatformStateMap
  subscriptionCredits: number
  topupCredits:        number
  listingId:           string | null
  retryingPlatforms:   Set<Platform>
  globalError:         string | null
}

type Action =
  | { type: 'SET_PLATFORMS';        platforms: Platform[] }
  | { type: 'ADVANCE_TO_UPLOAD' }
  | { type: 'SET_IMAGE';            image: UploadedImage }
  | { type: 'START_EXTRACTION' }
  | { type: 'SET_EXTRACTED';        data: ExtractedProduct }
  | { type: 'EXTRACTION_ERROR';     error: string }
  | { type: 'START_GENERATION';     platforms: Platform[] }
  | { type: 'PLATFORM_SUCCESS';     platform: Platform; listing: GeneratedListings[keyof GeneratedListings] }
  | { type: 'PLATFORM_ERROR';       platform: Platform; error: string }
  | { type: 'GENERATION_COMPLETE';  subscriptionCredits: number; topupCredits: number; listingId: string }
  | { type: 'START_RETRY';          platform: Platform }
  | { type: 'RETRY_SUCCESS';        platform: Platform; listing: GeneratedListings[keyof GeneratedListings] }
  | { type: 'RETRY_ERROR';          platform: Platform; error: string }
  | { type: 'SET_CREDITS';          subscriptionCredits: number; topupCredits: number }
  | { type: 'SET_GLOBAL_ERROR';     error: string }
  | { type: 'GO_TO_STEP';           step: Step }
  | { type: 'RESET' }

function buildInitialPlatformState(platforms: Platform[]): PlatformStateMap {
  return Object.fromEntries(
    platforms.map((p) => [p, { status: 'loading' as const, listing: null }])
  ) as PlatformStateMap
}

const initialState: State = {
  step:                'platforms',
  selectedPlatforms:   [],
  uploadedImage:       null,
  extractedData:       null,
  extracting:          false,
  extractError:        null,
  platformState:       {},
  subscriptionCredits: 0,
  topupCredits:        0,
  listingId:           null,
  retryingPlatforms:   new Set(),
  globalError:         null,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_PLATFORMS':
      return { ...state, selectedPlatforms: action.platforms }

    case 'ADVANCE_TO_UPLOAD':
      return { ...state, step: 'upload' }

    case 'SET_IMAGE':
      return { ...state, uploadedImage: action.image, step: 'validate', extractedData: null, extractError: null }

    case 'START_EXTRACTION':
      return { ...state, extracting: true, extractError: null }

    case 'SET_EXTRACTED':
      return { ...state, extracting: false, extractedData: action.data, step: 'confirm' }

    case 'EXTRACTION_ERROR':
      return { ...state, extracting: false, extractError: action.error }

    case 'START_GENERATION':
      return {
        ...state,
        step:          'results',
        platformState: buildInitialPlatformState(action.platforms),
        globalError:   null,
      }

    case 'PLATFORM_SUCCESS':
      return {
        ...state,
        platformState: {
          ...state.platformState,
          [action.platform]: { status: 'success', listing: action.listing },
        },
      }

    case 'PLATFORM_ERROR':
      return {
        ...state,
        platformState: {
          ...state.platformState,
          [action.platform]: { status: 'error', listing: null, error: action.error },
        },
      }

    case 'GENERATION_COMPLETE':
      return {
        ...state,
        subscriptionCredits: action.subscriptionCredits,
        topupCredits:        action.topupCredits,
        listingId:           action.listingId,
      }

    case 'START_RETRY': {
      const next = new Set(state.retryingPlatforms)
      next.add(action.platform)
      return {
        ...state,
        retryingPlatforms: next,
        platformState: {
          ...state.platformState,
          [action.platform]: { status: 'loading', listing: null },
        },
      }
    }

    case 'RETRY_SUCCESS': {
      const next = new Set(state.retryingPlatforms)
      next.delete(action.platform)
      return {
        ...state,
        retryingPlatforms: next,
        platformState: {
          ...state.platformState,
          [action.platform]: { status: 'success', listing: action.listing },
        },
      }
    }

    case 'RETRY_ERROR': {
      const next = new Set(state.retryingPlatforms)
      next.delete(action.platform)
      return {
        ...state,
        retryingPlatforms: next,
        platformState: {
          ...state.platformState,
          [action.platform]: { status: 'error', listing: null, error: action.error },
        },
      }
    }

    case 'SET_CREDITS':
      return {
        ...state,
        subscriptionCredits: action.subscriptionCredits,
        topupCredits:        action.topupCredits,
      }

    case 'SET_GLOBAL_ERROR':
      return { ...state, globalError: action.error }

    case 'GO_TO_STEP':
      return { ...state, step: action.step, globalError: null }

    case 'RESET':
      return { ...initialState }
  }
}

// ─── Step progress bar ────────────────────────────────────────────────────────

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'platforms', label: 'Platforms' },
  { id: 'upload',    label: 'Upload'    },
  { id: 'validate',  label: 'Analyse'   },
  { id: 'confirm',   label: 'Confirm'   },
  { id: 'results',   label: 'Results'   },
]
const STEP_ORDER: Step[] = STEPS.map((s) => s.id)

function StepBar({ current }: { current: Step }) {
  const currentIdx = STEP_ORDER.indexOf(current)
  return (
    // overflow-x-auto prevents layout breaking on screens narrower than
    // the full bar width; flex-shrink-0 on each item keeps dots from
    // collapsing. Labels are hidden on xs and shown from sm upward.
    <div className="flex items-center overflow-x-auto pb-1 -mb-1">
      {STEPS.map((s, i) => {
        const idx    = STEP_ORDER.indexOf(s.id)
        const done   = idx < currentIdx
        const active = idx === currentIdx
        const isLast = i === STEPS.length - 1
        return (
          <div key={s.id} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`
                  w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-semibold
                  transition-colors duration-150
                  ${done   ? 'bg-accent border-accent text-white' : ''}
                  ${active ? 'border-accent text-accent bg-accent-muted' : ''}
                  ${!done && !active ? 'border-border text-text-disabled' : ''}
                `}
              >
                {done ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {/* Labels hidden on xs to prevent overflow on 375px screens */}
              <span className={`text-xs hidden sm:block ${active ? 'text-accent' : done ? 'text-text-secondary' : 'text-text-disabled'}`}>
                {s.label}
              </span>
            </div>
            {/* Shorter connector on mobile, full width on sm+ */}
            {!isLast && <div className={`w-4 sm:w-8 h-px mb-4 sm:mx-1 mx-0.5 ${done ? 'bg-accent' : 'bg-border'}`} />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Credit preview banner ────────────────────────────────────────────────────

function CreditPreview({
  count,
  subscriptionCredits,
  topupCredits,
}: {
  count: number
  subscriptionCredits: number
  topupCredits: number
}) {
  const total  = subscriptionCredits + topupCredits
  const enough = total >= count
  return (
    <div
      className={`
        flex items-start gap-2 rounded-lg border px-4 py-3 text-sm
        ${enough ? 'border-border bg-surface text-text-secondary' : 'border-error bg-error-muted text-error'}
      `}
    >
      <CoinsIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      {enough ? (
        <span>
          Generating for{' '}
          <strong className="text-text-primary">{count} platform{count !== 1 ? 's' : ''}</strong>{' '}
          will use{' '}
          <strong className="text-text-primary">{count} credit{count !== 1 ? 's' : ''}</strong>. You
          have{' '}
          <strong className="text-text-primary">{subscriptionCredits}</strong> monthly +{' '}
          <strong className="text-text-primary">{topupCredits}</strong> top-up credits remaining.
        </span>
      ) : (
        <span>
          You need {count} credits but only have {total}.{' '}
          <a href="/account" className="underline font-medium">Buy more →</a>
        </span>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GeneratePage() {
  const { userId } = useAuth()
  const [state, dispatch] = useReducer(reducer, initialState)
  const confirmedDataRef = useRef<ExtractedProduct | null>(null)

  // Fetch credit balance once on mount
  useEffect(() => {
    fetch('/api/credits')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.subscriptionCredits === 'number') {
          dispatch({
            type:                'SET_CREDITS',
            subscriptionCredits: d.subscriptionCredits,
            topupCredits:        d.topupCredits,
          })
        }
      })
      .catch(() => {})
  }, [])

  // ── Platform toggle ─────────────────────────────────────────────────────────
  const handlePlatformToggle = useCallback((p: Platform) => {
    dispatch({
      type:      'SET_PLATFORMS',
      platforms: state.selectedPlatforms.includes(p)
        ? state.selectedPlatforms.filter((x) => x !== p)
        : [...state.selectedPlatforms, p],
    })
  }, [state.selectedPlatforms])

  const handlePlatformsContinue = useCallback(() => {
    if (state.selectedPlatforms.length === 0) return
    fetch('/api/user/preferred-platforms', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ platforms: state.selectedPlatforms }),
    }).catch(() => {})
    dispatch({ type: 'ADVANCE_TO_UPLOAD' })
  }, [state.selectedPlatforms])

  // ── Image uploaded ──────────────────────────────────────────────────────────
  const handleUploadComplete = useCallback((image: UploadedImage) => {
    dispatch({ type: 'SET_IMAGE', image })
  }, [])

  // ── Validation passed → trigger extraction ──────────────────────────────────
  const handleValidationPass = useCallback(async () => {
    if (!state.uploadedImage) return
    dispatch({ type: 'START_EXTRACTION' })
    try {
      const res = await fetch('/api/extract', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ imageUrl: state.uploadedImage.url }),
      })
      const data = await res.json()
      if (!res.ok || !data.extracted_data) {
        dispatch({ type: 'EXTRACTION_ERROR', error: data.error ?? 'Extraction failed' })
        return
      }
      dispatch({ type: 'SET_EXTRACTED', data: data.extracted_data as ExtractedProduct })
    } catch {
      dispatch({ type: 'EXTRACTION_ERROR', error: 'Network error — could not extract product data.' })
    }
  }, [state.uploadedImage])

  // ── Confirm + generate ──────────────────────────────────────────────────────
  const handleConfirm = useCallback(async (
    confirmedData: ExtractedProduct,
    platforms:     Platform[]
  ) => {
    confirmedDataRef.current = confirmedData
    dispatch({ type: 'START_GENERATION', platforms })

    try {
      const res = await fetch('/api/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl:      state.uploadedImage!.url,
          imageHash:     state.uploadedImage!.imageHash,
          extractedData: confirmedData,
          platforms,
        }),
      })

      const data: GenerateResponse & { listingId: string } = await res.json()

      if (!res.ok) {
        dispatch({ type: 'SET_GLOBAL_ERROR', error: (data as { error?: string }).error ?? 'Generation failed' })
        platforms.forEach((p) => {
          dispatch({ type: 'PLATFORM_ERROR', platform: p, error: 'Generation failed' })
        })
        return
      }

      dispatch({
        type:                'GENERATION_COMPLETE',
        subscriptionCredits: data.subscriptionCreditsRemaining,
        topupCredits:        data.topupCreditsRemaining,
        listingId:           data.listingId,
      })

      for (const p of platforms) {
        const listing = (data.listings as Record<Platform, GeneratedListings[keyof GeneratedListings]>)[p]
        if (listing && !data.failedPlatforms.includes(p)) {
          dispatch({ type: 'PLATFORM_SUCCESS', platform: p, listing })
        } else {
          dispatch({ type: 'PLATFORM_ERROR', platform: p, error: data.errors[p] ?? `${p} generation failed` })
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      state.selectedPlatforms.forEach((p) =>
        dispatch({ type: 'PLATFORM_ERROR', platform: p, error: msg })
      )
    }
  }, [state.uploadedImage, state.selectedPlatforms])

  // ── Retry ───────────────────────────────────────────────────────────────────
  const handleRetry = useCallback(async (platform: Platform) => {
    if (!confirmedDataRef.current || !state.uploadedImage) return

    const total = state.subscriptionCredits + state.topupCredits
    const ok = window.confirm(
      `Retry ${platform} listing for 1 credit? You have ${total} credits remaining.`
    )
    if (!ok) return

    dispatch({ type: 'START_RETRY', platform })

    try {
      const res = await fetch('/api/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl:      state.uploadedImage.url,
          imageHash:     state.uploadedImage.imageHash,
          extractedData: confirmedDataRef.current,
          platforms:     [platform],
        }),
      })
      const data: GenerateResponse & { listingId: string } = await res.json()

      dispatch({
        type:                'SET_CREDITS',
        subscriptionCredits: data.subscriptionCreditsRemaining,
        topupCredits:        data.topupCreditsRemaining,
      })

      const listing = (data.listings as Record<Platform, GeneratedListings[keyof GeneratedListings]>)[platform]
      if (res.ok && listing && !data.failedPlatforms.includes(platform)) {
        dispatch({ type: 'RETRY_SUCCESS', platform, listing })
      } else {
        dispatch({ type: 'RETRY_ERROR', platform, error: data.errors[platform] ?? 'Retry failed' })
      }
    } catch {
      dispatch({ type: 'RETRY_ERROR', platform, error: 'Network error' })
    }
  }, [state.uploadedImage, state.subscriptionCredits, state.topupCredits])

  const referralCode = userId ? userId.replace(/[^a-z0-9]/gi, '').slice(0, 12) : null

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-base">

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav className="border-b border-border bg-surface sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-150 flex items-center gap-1.5 flex-shrink-0"
          >
            ← Dashboard
          </Link>
          <Link href="/">
            <img src="/logo.svg" alt="listlistlist" style={{ height: '40px', width: 'auto' }} />
          </Link>
          <CreditBadge />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-medium tracking-tight text-text-primary">
              Generate listings
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Upload a product photo and get copy-paste-ready listings in under 60 seconds.
            </p>
          </div>
          {(state.subscriptionCredits > 0 || state.topupCredits > 0) && (
            <div className="flex items-center gap-1.5 text-sm flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span className={state.subscriptionCredits <= 5 ? 'text-warning font-medium' : 'text-text-secondary'}>
                {state.subscriptionCredits}
              </span>
              <span className="text-text-disabled">monthly</span>
              {state.topupCredits > 0 && (
                <>
                  <span className="text-border-2 mx-1">·</span>
                  <span className="w-2 h-2 rounded-full bg-text-secondary" />
                  <span className="text-text-secondary">{state.topupCredits}</span>
                  <span className="text-text-disabled">top-up</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Step progress */}
        <StepBar current={state.step} />

        {/* Global error (not shown when on results — handled per-platform there) */}
        {state.globalError && state.step !== 'results' && (
          <div className="rounded-lg border border-error bg-error-muted px-4 py-3 text-sm text-error">
            {state.globalError}
          </div>
        )}

        {/* ── Step 1: Platform selection ─────────────────────────────────── */}
        {state.step === 'platforms' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-medium text-text-primary">Choose your platforms</h2>
              <p className="text-sm text-text-secondary mt-1">
                Select all platforms you sell on. Each platform uses 1 credit per generation.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ALL_PLATFORMS.map((p) => (
                <PlatformToggleCard
                  key={p}
                  platform={p}
                  selected={state.selectedPlatforms.includes(p)}
                  onToggle={handlePlatformToggle}
                />
              ))}
            </div>

            {state.selectedPlatforms.length > 0 && (
              <CreditPreview
                count={state.selectedPlatforms.length}
                subscriptionCredits={state.subscriptionCredits}
                topupCredits={state.topupCredits}
              />
            )}

            <button
              onClick={handlePlatformsContinue}
              disabled={state.selectedPlatforms.length === 0}
              className="
                w-full bg-accent hover:bg-accent-hover text-white font-medium
                rounded-lg px-5 py-3 transition-colors duration-150
                disabled:opacity-40 disabled:cursor-not-allowed
              "
            >
              Continue — upload image
            </button>
          </div>
        )}

        {/* ── Step 2: Upload ─────────────────────────────────────────────── */}
        {state.step === 'upload' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'platforms' })}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                ← Back
              </button>
              <div>
                <h2 className="text-xl font-medium text-text-primary">Upload your product photo</h2>
                <p className="text-sm text-text-secondary mt-0.5">
                  A clean, well-lit photo on a plain background gives the best results. JPG, PNG or
                  WebP, max 4 MB.
                </p>
              </div>
            </div>
            <UploadDropzone onUploadComplete={handleUploadComplete} />
          </div>
        )}

        {/* ── Step 3: Validate + extract ──────────────────────────────────── */}
        {state.step === 'validate' && state.uploadedImage && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'upload' })}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                ← Back
              </button>
              <div>
                <h2 className="text-xl font-medium text-text-primary">Analyse image</h2>
                <p className="text-sm text-text-secondary mt-0.5">
                  We validate your image then extract product details. No credits are used at this stage.
                </p>
              </div>
            </div>

            {/* Image preview */}
            <div className="rounded-xl overflow-hidden border border-border bg-surface w-full aspect-video flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={state.uploadedImage.url}
                alt="Uploaded product"
                className="max-h-60 max-w-full object-contain"
              />
            </div>

            <ImageValidator
              image={state.uploadedImage}
              onValidationPass={handleValidationPass}
              disabled={state.extracting}
            />

            {/* Extraction in progress */}
            {state.extracting && (
              <div className="flex items-center gap-3 text-sm text-text-secondary">
                <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                Extracting product details…
              </div>
            )}

            {/* Extraction error */}
            {state.extractError && (
              <div className="rounded-lg border border-error bg-error-muted px-4 py-3 text-sm text-error">
                {state.extractError}
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Confirm ─────────────────────────────────────────────── */}
        {state.step === 'confirm' && state.extractedData && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => dispatch({ type: 'GO_TO_STEP', step: 'validate' })}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                ← Back
              </button>
              <div>
                <h2 className="text-xl font-medium text-text-primary">Confirm product details</h2>
                <p className="text-sm text-text-secondary mt-0.5">
                  Review and edit the extracted details. Credits are deducted when you confirm.
                </p>
              </div>
            </div>
            <ExtractionConfirmForm
              initialData={state.extractedData}
              selectedPlatforms={state.selectedPlatforms}
              creditCost={state.selectedPlatforms.length}
              subscriptionCredits={state.subscriptionCredits}
              topupCredits={state.topupCredits}
              onConfirm={handleConfirm}
            />
          </div>
        )}

        {/* ── Step 5: Results ─────────────────────────────────────────────── */}
        {state.step === 'results' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-medium text-text-primary">Your listings</h2>
                <p className="text-sm text-text-secondary mt-0.5">
                  Copy any field directly, or use &quot;Copy all&quot; for the full platform export.
                </p>
              </div>
              <button
                onClick={() => dispatch({ type: 'RESET' })}
                className="
                  inline-flex items-center gap-1.5 flex-shrink-0
                  border border-border hover:border-border-2 text-text-secondary
                  hover:text-text-primary bg-white
                  px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150
                "
              >
                <ZapIcon className="w-3.5 h-3.5" />
                New listing
              </button>
            </div>

            <ListingResultTabs
              platforms={state.selectedPlatforms}
              platformState={state.platformState}
              referralCode={referralCode}
              subscriptionCredits={state.subscriptionCredits}
              topupCredits={state.topupCredits}
              onRetry={handleRetry}
              retryingPlatforms={state.retryingPlatforms}
            />
          </div>
        )}

      </div>
    </div>
  )
}
