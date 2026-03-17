'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { ZapIcon, UploadCloudIcon, AlertCircleIcon } from 'lucide-react'

// ─── Sample products ──────────────────────────────────────────────────────────

const SAMPLES = [
  {
    id:        'mug'    as const,
    label:     'Ceramic mug',
    imageUrl:  'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&q=80',
    emoji:     '☕',
  },
  {
    id:        'wallet' as const,
    label:     'Leather wallet',
    imageUrl:  'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&q=80',
    emoji:     '👛',
  },
  {
    id:        'candle' as const,
    label:     'Scented candle',
    imageUrl:  'https://images.unsplash.com/photo-1602028915047-37269d1a73f7?w=400&q=80',
    emoji:     '🕯️',
  },
]

type SampleId = 'mug' | 'wallet' | 'candle'

// ─── Etsy preview output ──────────────────────────────────────────────────────

function EtsyPreview({
  title,
  tags,
  visible,
}: {
  title:   string
  tags:    string[]
  visible: boolean
}) {
  return (
    <div
      className={`
        space-y-4 transition-all duration-500
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}
      `}
    >
      {/* Platform header */}
      <div className="flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: '#F1641E' }}
        />
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest">
          Etsy preview
        </span>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <span className="text-xs text-text-secondary uppercase tracking-widest font-medium">
          Title
        </span>
        <div className="bg-surface-2 border border-border rounded-lg px-4 py-3 font-mono text-sm text-text-primary leading-relaxed">
          {title}
        </div>
      </div>

      {/* First 2 tags */}
      <div className="space-y-1.5">
        <span className="text-xs text-text-secondary uppercase tracking-widest font-medium">
          Tags (preview — 2 of 13)
        </span>
        <div className="flex flex-wrap gap-2">
          {tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 rounded bg-surface-2 border border-border text-xs text-text-secondary font-mono"
            >
              {tag}
            </span>
          ))}
          {/* Blurred remaining tags hint */}
          <span className="px-2.5 py-1 rounded bg-surface-2 border border-border text-xs text-text-disabled font-mono select-none blur-[3px]">
            handmade-gift
          </span>
          <span className="px-2.5 py-1 rounded bg-surface-2 border border-border text-xs text-text-disabled font-mono select-none blur-[3px]">
            unique-present
          </span>
          <span className="text-xs text-text-disabled self-center">+9 more</span>
        </div>
      </div>

      {/* Gate */}
      <div className="rounded-xl border border-accent bg-accent-muted px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">
            See all 6 platforms in full
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            Amazon, eBay, Shopify, WooCommerce, TikTok Shop + complete Etsy listing
          </p>
        </div>
        <Link
          href="/sign-up"
          className="
            flex-shrink-0 inline-flex items-center gap-1.5
            bg-accent hover:bg-accent-hover text-white font-semibold
            px-4 py-2 rounded-lg text-sm transition-colors duration-150
          "
        >
          <ZapIcon className="w-3.5 h-3.5" />
          Start free trial →
        </Link>
      </div>
    </div>
  )
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function GeneratingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-surface-2" />
        <div className="h-3 w-24 bg-surface-2 rounded" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-12 bg-surface-2 rounded" />
        <div className="h-14 bg-surface-2 rounded-lg" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-16 bg-surface-2 rounded" />
        <div className="flex gap-2">
          <div className="h-7 w-24 bg-surface-2 rounded" />
          <div className="h-7 w-28 bg-surface-2 rounded" />
          <div className="h-7 w-20 bg-surface-2 rounded opacity-40" />
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type DemoStatus = 'idle' | 'loading' | 'success' | 'error' | 'rate_limited'

export default function DemoSection() {
  const [selectedSample, setSelectedSample] = useState<SampleId | null>(null)
  const [status,  setStatus]  = useState<DemoStatus>('idle')
  const [preview, setPreview] = useState<{ title: string; tags: string[] } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const runDemo = useCallback(async (payload: { sampleProduct?: SampleId; imageUrl?: string }) => {
    setStatus('loading')
    setPreview(null)
    setErrorMsg(null)

    try {
      const res  = await fetch('/api/demo', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const data = await res.json()

      if (res.status === 429) {
        setStatus('rate_limited')
        setErrorMsg(data.error)
        return
      }

      if (!res.ok) {
        setStatus('error')
        setErrorMsg(data.error ?? 'Something went wrong. Try again.')
        return
      }

      setPreview(data.etsy_preview)
      setStatus('success')
    } catch {
      setStatus('error')
      setErrorMsg('Network error. Check your connection and try again.')
    }
  }, [])

  const handleSampleClick = useCallback((sample: typeof SAMPLES[number]) => {
    setSelectedSample(sample.id)
    runDemo({ sampleProduct: sample.id })
  }, [runDemo])

  // Drag-and-drop / file upload (converts to data URL then passes as imageUrl)
  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setStatus('error')
      setErrorMsg('Only image files are supported.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setStatus('error')
      setErrorMsg('File is too large. Maximum size is 5 MB.')
      return
    }

    setSelectedSample(null)
    setStatus('loading')
    setPreview(null)
    setErrorMsg(null)

    // Read as data URL and pass directly to the demo route
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      runDemo({ imageUrl: dataUrl })
    }
    reader.onerror = () => {
      setStatus('error')
      setErrorMsg('Could not read the file.')
    }
    reader.readAsDataURL(file)
  }, [runDemo])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-card">
      <div className="p-6 sm:p-8 space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-xs text-text-secondary uppercase tracking-widest font-medium">
            Try it now — no sign-up required
          </p>
          <h3 className="text-lg font-medium text-text-primary">
            Click a product to see real AI-generated copy
          </h3>
        </div>

        {/* Sample product cards */}
        <div className="grid grid-cols-3 gap-3">
          {SAMPLES.map((sample) => {
            const isSelected = selectedSample === sample.id
            const isLoading  = isSelected && status === 'loading'

            return (
              <button
                key={sample.id}
                onClick={() => handleSampleClick(sample)}
                disabled={status === 'loading'}
                className={`
                  relative rounded-xl overflow-hidden border
                  transition-all duration-150 group
                  hover:-translate-y-1
                  disabled:cursor-not-allowed disabled:opacity-70
                  ${isSelected
                    ? 'border-accent ring-1 ring-accent/30'
                    : 'border-border hover:border-border-2'}
                `}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sample.imageUrl}
                  alt={sample.label}
                  className="w-full aspect-square object-cover"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-150" />

                {/* Loading overlay */}
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                    <div
                      className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: '#F1641E40', borderTopColor: 'transparent' }}
                    />
                  </div>
                )}

                <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/50 to-transparent">
                  <p className="text-xs font-medium text-white text-center">
                    {sample.label}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Upload your own */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-text-disabled">or upload your own</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <label
          className={`
            flex flex-col items-center justify-center gap-2
            border-2 border-dashed rounded-xl py-5 px-4 cursor-pointer
            transition-colors duration-150
            ${dragOver
              ? 'border-accent bg-accent-muted'
              : 'border-border hover:border-border-2'}
          `}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <UploadCloudIcon className="w-5 h-5 text-text-disabled" />
          <span className="text-xs text-text-secondary text-center">
            Drop an image here, or{' '}
            <span className="text-accent font-medium">browse</span>
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleFileInput}
            disabled={status === 'loading'}
          />
        </label>

        {/* ── Output area ────────────────────────────────────────────────────── */}
        {status === 'loading' && <GeneratingSkeleton />}

        {status === 'error' && (
          <div className="flex items-start gap-3 rounded-xl border border-error bg-error-muted px-4 py-3">
            <AlertCircleIcon className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
            <p className="text-sm text-error">{errorMsg}</p>
          </div>
        )}

        {status === 'rate_limited' && (
          <div className="rounded-xl border border-warning bg-warning-muted px-4 py-4 space-y-3 text-center">
            <p className="text-sm text-warning font-medium">{errorMsg}</p>
            <Link
              href="/sign-up"
              className="
                inline-flex items-center gap-1.5
                bg-accent hover:bg-accent-hover text-white font-semibold
                px-4 py-2 rounded-lg text-sm transition-colors duration-150
              "
            >
              <ZapIcon className="w-3.5 h-3.5" />
              Start free trial — 10 credits free
            </Link>
          </div>
        )}

        {status === 'success' && preview && (
          <EtsyPreview
            title={preview.title}
            tags={preview.tags}
            visible={true}
          />
        )}
      </div>
    </div>
  )
}
