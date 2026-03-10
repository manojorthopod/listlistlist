'use client'

import { useState, useEffect, useRef } from 'react'
import { ShieldCheckIcon, AlertCircleIcon, ZapIcon } from 'lucide-react'
import type { UploadedImage } from './upload-dropzone'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ValidationState =
  | 'idle'
  | 'validating'
  | 'valid'
  | 'invalid'
  | 'error'

export interface ValidationResult {
  isValid: boolean
  reason:  string
}

interface ImageValidatorProps {
  /** The uploaded image returned by UploadDropzone.onUploadComplete */
  image:             UploadedImage
  /** Called when validation passes — parent can proceed to extraction */
  onValidationPass:  (result: ValidationResult) => void
  /** Called if validation fails or errors — parent stays on upload step */
  onValidationFail?: (result: ValidationResult) => void
  /** Disable the button (e.g. while a later step is running) */
  disabled?:         boolean
}

// ─── Progress bar animation ───────────────────────────────────────────────────
// Runs from 0 → ~85 % during the API call, then jumps to 100 % on completion.
// Pure CSS animation driven by React state — no third-party progress library.

const PROGRESS_TICK_MS  = 80
const PROGRESS_INCREMENT = 1.4   // % per tick — reaches ~85 % in ~4.8 s

// ─── Component ───────────────────────────────────────────────────────────────

export function ImageValidator({
  image,
  onValidationPass,
  onValidationFail,
  disabled = false,
}: ImageValidatorProps) {
  const [state,    setState]    = useState<ValidationState>('idle')
  const [progress, setProgress] = useState(0)
  const [reason,   setReason]   = useState<string | null>(null)

  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  // Clean up interval on unmount
  useEffect(() => () => { stopProgress() }, [])

  function startProgress() {
    setProgress(0)
    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        // Slow down as we approach the "waiting" ceiling
        if (prev >= 85) return prev
        return Math.min(prev + PROGRESS_INCREMENT, 85)
      })
    }, PROGRESS_TICK_MS)
  }

  function stopProgress() {
    if (progressInterval.current) {
      clearInterval(progressInterval.current)
      progressInterval.current = null
    }
  }

  function finishProgress() {
    stopProgress()
    setProgress(100)
  }

  // ── Main validation trigger ─────────────────────────────────────────────────
  async function handleAnalyse() {
    if (state === 'validating' || disabled) return

    setState('validating')
    setReason(null)
    startProgress()

    try {
      const res = await fetch('/api/validate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ imageUrl: image.url }),
      })

      const data = await res.json()

      // ── Network / server error ───────────────────────────────────────────
      if (!res.ok) {
        finishProgress()
        setState('error')
        setReason(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      finishProgress()

      // ── Validation failed (not a real product) ──────────────────────────
      if (!data.is_valid_product) {
        setState('invalid')
        setReason(data.reason ?? 'No product detected.')
        onValidationFail?.({ isValid: false, reason: data.reason ?? '' })
        return
      }

      // ── Validation passed ───────────────────────────────────────────────
      setState('valid')
      setReason(data.reason ?? '')
      onValidationPass({ isValid: true, reason: data.reason ?? '' })

    } catch {
      finishProgress()
      setState('error')
      setReason('Could not reach the server. Check your connection and try again.')
    }
  }

  const isValidating = state === 'validating'

  return (
    <div className="space-y-4">

      {/* ── Analyse button + progress bar ──────────────────────────────────── */}
      <div className="relative">
        <button
          onClick={handleAnalyse}
          disabled={isValidating || state === 'valid' || disabled}
          className={`
            w-full flex items-center justify-center gap-2 font-semibold rounded-lg px-5 py-3
            transition-colors duration-150
            disabled:opacity-40 disabled:cursor-not-allowed
            ${state === 'valid'
              ? 'bg-success-muted border border-success text-success cursor-default'
              : 'bg-accent hover:bg-accent-hover text-white'}
          `}
        >
          {state === 'valid' ? (
            <>
              <ShieldCheckIcon className="w-4 h-4" />
              Image verified
            </>
          ) : isValidating ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Analysing image…
            </>
          ) : (
            <>
              <ZapIcon className="w-4 h-4" />
              Analyse Image
            </>
          )}
        </button>

        {/* Progress bar — only visible while validating */}
        {isValidating && (
          <div
            className="absolute bottom-0 left-0 h-0.5 bg-accent-light rounded-b-lg transition-all"
            style={{
              width:            `${progress}%`,
              transitionDuration: progress === 100 ? '150ms' : `${PROGRESS_TICK_MS}ms`,
              transitionTimingFunction: 'linear',
            }}
          />
        )}
      </div>

      {/* ── Invalid product error ──────────────────────────────────────────── */}
      {state === 'invalid' && (
        <div className="bg-error-muted border border-error rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="w-5 h-5 text-error shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-error text-sm font-medium">
                We couldn&apos;t identify a product in this photo. Please upload a clear photo
                of a single item. No credits were used.
              </p>
              {/* Surface the AI's specific reason beneath the spec copy */}
              {reason && (
                <p className="text-text-secondary text-sm leading-relaxed">
                  {reason}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Server / network error ─────────────────────────────────────────── */}
      {state === 'error' && (
        <div className="bg-error-muted border border-error rounded-lg px-4 py-3 flex items-start gap-3">
          <AlertCircleIcon className="w-4 h-4 text-error shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-error text-sm font-medium">Analysis failed</p>
            {reason && (
              <p className="text-text-secondary text-sm">{reason}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Success state hint ─────────────────────────────────────────────── */}
      {state === 'valid' && (
        <p className="text-text-secondary text-sm text-center">
          Product identified. Confirm the details below before generating.
        </p>
      )}

    </div>
  )
}
