'use client'

import { useCallback, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { UploadCloudIcon, AlertCircleIcon, XIcon, ShieldCheckIcon } from 'lucide-react'
import { useUploadThing } from '@/lib/uploadthing-client'
import { hashImageFile, isCryptoAvailable } from '@/lib/imageHash'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadedImage {
  url:       string
  imageHash: string
  fileName:  string
  fileSize:  number
}

interface DuplicateInfo {
  existingListingId: string
  existingCreatedAt: string
  existingPlatforms: string[]
}

interface UploadDropzoneProps {
  /** Called when upload completes and the duplicate check resolves */
  onUploadComplete: (image: UploadedImage) => void
  /** Optionally disable the dropzone (e.g. while generating) */
  disabled?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES      = 4 * 1024 * 1024 // 4 MB (UploadThing limit)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024)          return `${bytes} B`
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ─── Component ───────────────────────────────────────────────────────────────

export function UploadDropzone({ onUploadComplete, disabled = false }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // UI state
  const [isDragging,    setIsDragging]    = useState(false)
  const [preview,       setPreview]       = useState<string | null>(null)
  const [fileName,      setFileName]      = useState<string | null>(null)
  const [fileSize,      setFileSize]      = useState<number>(0)
  const [error,         setError]         = useState<string | null>(null)
  const [hashProgress,  setHashProgress]  = useState(false)
  const [duplicate,     setDuplicate]     = useState<DuplicateInfo | null>(null)
  const [dismissed,     setDismissed]     = useState(false) // user chose to continue
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null)

  // UploadThing hook
  const { startUpload, isUploading } = useUploadThing('productImage', {
    onUploadError: (err) => {
      setError(`Upload failed: ${err.message}`)
      setHashProgress(false)
    },
  })

  // ── File validation ────────────────────────────────────────────────────────
  function validateFile(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Only JPG, PNG, and WebP images are accepted.'
    }
    if (file.size > MAX_BYTES) {
            return `File is too large (${formatBytes(file.size)}). Maximum size is 4 MB.`
    }
    return null
  }

  // ── Core upload flow ───────────────────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    setError(null)
    setDuplicate(null)
    setDismissed(false)
    setUploadedImage(null)

    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setFileName(file.name)
    setFileSize(file.size)

    // ── Step 1: SHA-256 hash client-side ────────────────────────────────────
    let hash = ''
    if (isCryptoAvailable()) {
      setHashProgress(true)
      try {
        hash = await hashImageFile(file)
      } catch {
        // Non-fatal — proceed without dedup check
      }
      setHashProgress(false)
    }

    // ── Step 2: Deduplication check (before upload, no credits used) ────────
    if (hash) {
      try {
        const res  = await fetch('/api/check-duplicate', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ imageHash: hash }),
        })
        const data = await res.json()
        if (data.isDuplicate) {
          setDuplicate({
            existingListingId: data.existingListingId,
            existingCreatedAt: data.existingCreatedAt,
            existingPlatforms: data.existingPlatforms,
          })
          // Don't start upload yet — wait for user decision
          // Store file + hash in a ref for if they choose to continue
          pendingRef.current = { file, hash }
          return
        }
      } catch {
        // Non-fatal — proceed without dedup warning
      }
    }

    await doUpload(file, hash)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Ref so we can access the pending file from the duplicate-warning button handler
  const pendingRef = useRef<{ file: File; hash: string } | null>(null)

  async function doUpload(file: File, hash: string) {
    const uploaded = await startUpload([file])
    if (!uploaded?.[0]) {
      setError('Upload did not return a URL. Please try again.')
      return
    }

    const result: UploadedImage = {
      url:       uploaded[0].ufsUrl,
      imageHash: hash,
      fileName:  file.name,
      fileSize:  file.size,
    }
    setUploadedImage(result)
    onUploadComplete(result)
  }

  // ── User dismisses duplicate warning and proceeds anyway ──────────────────
  async function handleContinueAnyway() {
    setDismissed(true)
    setDuplicate(null)
    if (pendingRef.current) {
      await doUpload(pendingRef.current.file, pendingRef.current.hash)
      pendingRef.current = null
    }
  }

  // ── Drag-and-drop handlers ─────────────────────────────────────────────────
  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }
  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    // Reset input so the same file can be re-selected after clearing
    e.target.value = ''
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  function reset() {
    setPreview(null)
    setFileName(null)
    setFileSize(0)
    setError(null)
    setDuplicate(null)
    setDismissed(false)
    setUploadedImage(null)
    setHashProgress(false)
    pendingRef.current = null
    if (inputRef.current) inputRef.current.value = ''
  }

  const isProcessing = hashProgress || isUploading
  const isComplete   = !!uploadedImage

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Dropzone area ─────────────────────────────────────────────────── */}
      {!preview ? (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Upload product image"
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`
            relative flex flex-col items-center justify-center
            border-2 border-dashed rounded-xl p-12 text-center
            transition-colors duration-150 select-none
            ${disabled
              ? 'border-border opacity-40 cursor-not-allowed'
              : isDragging
              ? 'border-accent bg-accent-muted cursor-copy'
              : 'border-border hover:border-border-2 hover:bg-surface-2 cursor-pointer'}
          `}
        >
          <UploadCloudIcon className="w-10 h-10 text-text-secondary mb-4" />
          <p className="text-text-primary font-medium text-base">
            {isDragging ? 'Drop your image here' : 'Drag and drop your product photo'}
          </p>
          <p className="text-text-secondary text-sm mt-1">
            or <span className="text-accent">browse to upload</span>
          </p>
          <p className="text-text-disabled text-xs font-mono mt-3">
            JPG · PNG · WebP · max 4 MB
          </p>
        </div>
      ) : (
        /* ── Preview card ───────────────────────────────────────────────── */
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="relative aspect-square w-full max-w-sm mx-auto">
            <Image
              src={preview}
              alt="Product image preview"
              fill
              className="object-contain p-4"
              unoptimized // local blob URL
            />
            {/* Remove button */}
            {!isProcessing && !isComplete && (
              <button
                onClick={reset}
                className="absolute top-3 right-3 bg-surface-2 hover:bg-error-muted border border-border hover:border-error text-text-secondary hover:text-error rounded-lg p-1.5 transition-colors duration-150"
                aria-label="Remove image"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* File meta */}
          <div className="px-6 py-3 border-t border-border flex items-center justify-between">
            <span className="text-text-secondary text-xs font-mono truncate max-w-[200px]">
              {fileName}
            </span>
            <span className="text-text-disabled text-xs font-mono shrink-0">
              {formatBytes(fileSize)}
            </span>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={onInputChange}
        disabled={disabled || isProcessing}
      />

      {/* ── Upload progress indicator ──────────────────────────────────────── */}
      {isUploading && (
        <div className="bg-surface-2 border border-border rounded-lg px-4 py-3 flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin shrink-0" />
          <span className="text-text-secondary text-sm">Uploading image…</span>
        </div>
      )}

      {hashProgress && !isUploading && (
        <div className="bg-surface-2 border border-border rounded-lg px-4 py-3 flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin shrink-0" />
          <span className="text-text-secondary text-sm">Checking image…</span>
        </div>
      )}

      {/* ── Upload success ─────────────────────────────────────────────────── */}
      {isComplete && (
        <div className="bg-success-muted border border-success rounded-lg px-4 py-3 flex items-center gap-3">
          <ShieldCheckIcon className="w-4 h-4 text-success shrink-0" />
          <span className="text-success text-sm font-medium">Image uploaded successfully</span>
        </div>
      )}

      {/* ── Duplicate warning ──────────────────────────────────────────────── */}
      {duplicate && !dismissed && (
        <div className="bg-warning-muted border border-warning rounded-xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-text-primary font-medium text-sm">
                You've generated listings for this product before
              </p>
              <p className="text-text-secondary text-sm">
                A listing was created on{' '}
                <span className="text-text-primary">
                  {formatDate(duplicate.existingCreatedAt)}
                </span>
                {duplicate.existingPlatforms.length > 0 && (
                  <>
                    {' '}for{' '}
                    <span className="text-text-primary">
                      {duplicate.existingPlatforms
                        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                        .join(', ')}
                    </span>
                  </>
                )}
                .
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/listings/${duplicate.existingListingId}`}
              className="flex-1 text-center border border-border-2 hover:border-accent text-text-primary font-medium rounded-lg px-4 py-2.5 text-sm transition-colors duration-150"
            >
              View previous listing
            </Link>
            <button
              onClick={handleContinueAnyway}
              className="flex-1 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors duration-150"
            >
              Generate fresh copy
            </button>
          </div>
        </div>
      )}

      {/* ── Error state ───────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-error-muted border border-error rounded-lg px-4 py-3 flex items-start gap-3">
          <AlertCircleIcon className="w-4 h-4 text-error shrink-0 mt-0.5" />
          <span className="text-error text-sm">{error}</span>
        </div>
      )}

    </div>
  )
}
