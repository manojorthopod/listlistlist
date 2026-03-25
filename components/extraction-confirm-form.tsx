'use client'

import { useState, useCallback, KeyboardEvent } from 'react'
import { XIcon, SlidersHorizontalIcon, AlertCircleIcon } from 'lucide-react'
import type { ExtractedProduct, Platform } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractionConfirmFormProps {
  /** Initial data returned by /api/extract */
  initialData:         ExtractedProduct
  /** Selected platforms carried over from Step 1 */
  selectedPlatforms:   Platform[]
  /** Credit cost for the selected platforms */
  creditCost:          number
  /** Monthly subscription credits remaining */
  subscriptionCredits: number
  /** Never-expiring top-up credits remaining */
  topupCredits:        number
  /** Called when the user confirms and proceeds to generation */
  onConfirm:           (data: ExtractedProduct, platforms: Platform[]) => void
  /** Disabled while generation is in-flight */
  disabled?:           boolean
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

// Reusable labelled field wrapper
function Field({
  label,
  hint,
  children,
}: {
  label:    string
  hint?:    string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-medium uppercase tracking-widest text-text-secondary">
          {label}
        </label>
        {hint && <span className="text-xs text-text-disabled">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

// Shared input styles
const inputCls =
  'w-full bg-surface-2 border border-border focus:border-accent focus:ring-1 ' +
  'focus:ring-accent/30 rounded-lg px-4 py-2.5 text-text-primary placeholder:text-text-disabled ' +
  'text-base outline-none transition-colors duration-150'

// ─── Tag editor ───────────────────────────────────────────────────────────────

function TagEditor({
  tags,
  onChange,
  placeholder = 'Add a feature…',
  maxTags = 20,
}: {
  tags:        string[]
  onChange:    (tags: string[]) => void
  placeholder?: string
  maxTags?:    number
}) {
  const [input, setInput] = useState('')

  function addTag(value: string) {
    const trimmed = value.trim()
    if (!trimmed || tags.includes(trimmed) || tags.length >= maxTags) return
    onChange([...tags, trimmed])
    setInput('')
  }

  function removeTag(index: number) {
    onChange(tags.filter((_, i) => i !== index))
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    }
    if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  return (
    <div className="bg-surface-2 border border-border focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30 rounded-lg px-3 py-2 transition-colors duration-150 min-h-[44px]">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 bg-surface border border-border rounded-lg px-2.5 py-1 text-sm text-text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(i)}
              className="text-text-disabled hover:text-error transition-colors duration-150"
              aria-label={`Remove "${tag}"`}
            >
              <XIcon className="w-3 h-3" />
            </button>
          </span>
        ))}
        {tags.length < maxTags && (
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => { if (input.trim()) addTag(input) }}
            placeholder={tags.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-text-primary placeholder:text-text-disabled py-0.5"
          />
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const CONDITIONS = ['New', 'Used', 'Handmade', 'Vintage'] as const

export function ExtractionConfirmForm({
  initialData,
  selectedPlatforms,
  creditCost,
  subscriptionCredits,
  topupCredits,
  onConfirm,
  disabled = false,
}: ExtractionConfirmFormProps) {
  const availableCredits = subscriptionCredits + topupCredits
  // ── Form state — mirrors ExtractedProduct ──────────────────────────────────
  const [productType,     setProductType]     = useState(initialData.product_type)
  const [material,        setMaterial]        = useState(initialData.material ?? '')
  const [color,           setColor]           = useState(initialData.color ?? '')
  const [dimensions,      setDimensions]      = useState(initialData.dimensions ?? '')
  const [style,           setStyle]           = useState(initialData.style ?? '')
  const [keyFeatures,     setKeyFeatures]     = useState<string[]>(initialData.key_features)
  const [condition,       setCondition]       = useState<typeof CONDITIONS[number]>(
    (initialData.condition as typeof CONDITIONS[number]) ?? 'New'
  )
  const [targetAudience,  setTargetAudience]  = useState(initialData.target_audience ?? '')
  const [brandVoice,      setBrandVoice]      = useState(initialData.brand_voice ?? '')
  const [savingVoice,     setSavingVoice]     = useState(false)
  const [voiceSaved,      setVoiceSaved]      = useState(false)

  const insufficientCredits = availableCredits < creditCost
  const canSubmit           = productType.trim().length > 0 && !insufficientCredits && !disabled

  // ── Build confirmed data object ────────────────────────────────────────────
  const buildConfirmedData = useCallback((): ExtractedProduct => ({
    product_type:       productType.trim(),
    material:           material.trim()   || null,
    color:              color.trim()      || null,
    // CRITICAL: never pass user-typed dimensions if they leave it blank
    dimensions:         dimensions.trim() || null,
    style:              style.trim()      || null,
    key_features:       keyFeatures,
    condition,
    suggested_category: initialData.suggested_category,
    target_audience:    targetAudience.trim() || null,
    brand_voice:        brandVoice.trim()     || null,
  }), [productType, material, color, dimensions, style, keyFeatures, condition,
       targetAudience, brandVoice, initialData.suggested_category])

  const showManualEntryBanner =
    initialData.extraction_incomplete === true ||
    (initialData.manual_entry_hint != null && initialData.manual_entry_hint.length > 0)

  // ── Save brand voice to user profile ──────────────────────────────────────
  async function handleSaveBrandVoice() {
    if (!brandVoice.trim() || savingVoice) return
    setSavingVoice(true)
    try {
      await fetch('/api/user/brand-voice', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ brand_voice: brandVoice.trim() }),
      })
      setVoiceSaved(true)
      setTimeout(() => setVoiceSaved(false), 3000)
    } finally {
      setSavingVoice(false)
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onConfirm(buildConfirmedData(), selectedPlatforms)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* ── Section: AI-extracted fields ────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-5">
          <SlidersHorizontalIcon className="w-4 h-4 text-text-secondary" />
          <h2 className="text-xl font-medium text-text-primary">Confirm product details</h2>
        </div>
        <p className="text-text-secondary text-sm leading-relaxed">
          Review what we extracted from your image. Edit anything that&apos;s wrong or missing
          before generating — accurate data means better listings.
        </p>
      </div>

      {showManualEntryBanner && (
        <div
          role="status"
          className="flex gap-3 rounded-xl border border-warning bg-warning-muted p-4 text-sm text-text-primary"
        >
          <AlertCircleIcon className="w-5 h-5 shrink-0 text-warning" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium text-text-primary">Add product details manually</p>
            <p className="text-text-secondary leading-relaxed">
              {initialData.manual_entry_hint ??
                'Enter the product name and any key details you know — large items and vehicles often need seller-provided specifics.'}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

        {/* Product type */}
        <div className="sm:col-span-2">
          <Field label="Product type" hint="Required">
            <input
              type="text"
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              placeholder="e.g. Oak dining table, 2018 estate car, OEM brake caliper"
              required
              disabled={disabled}
              className={inputCls}
            />
          </Field>
        </div>

        {/* Material */}
        <Field label="Material">
          <input
            type="text"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            placeholder="e.g. Stoneware, Full-grain leather"
            disabled={disabled}
            className={inputCls}
          />
        </Field>

        {/* Colour */}
        <Field label="Colour">
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="e.g. Matte black, Natural beige"
            disabled={disabled}
            className={inputCls}
          />
        </Field>

        {/* Dimensions — explicit warning label */}
        <Field
          label="Dimensions"
          hint="Leave blank if unknown. Never guess."
        >
          <input
            type="text"
            value={dimensions}
            onChange={(e) => setDimensions(e.target.value)}
            placeholder="e.g. 10cm × 8cm × 12cm"
            disabled={disabled}
            className={inputCls}
          />
        </Field>

        {/* Style */}
        <Field label="Style">
          <input
            type="text"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder="e.g. Minimalist, Rustic, Modern"
            disabled={disabled}
            className={inputCls}
          />
        </Field>

        {/* Condition */}
        <div className="sm:col-span-2">
          <Field label="Condition">
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => !disabled && setCondition(c)}
                  disabled={disabled}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors duration-150 ${
                    condition === c
                      ? 'bg-accent-muted border-accent text-text-primary'
                      : 'bg-surface-2 border-border text-text-secondary hover:border-border-2'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* Key features tag editor */}
        <div className="sm:col-span-2">
          <Field
            label="Key features"
            hint="Press Enter or comma to add · Backspace to remove last"
          >
            <TagEditor
              tags={keyFeatures}
              onChange={disabled ? () => {} : setKeyFeatures}
              placeholder="e.g. Dishwasher safe, Double-walled…"
              maxTags={10}
            />
          </Field>
        </div>
      </div>

      {/* ── Section: User-added context ──────────────────────────────────────── */}
      <div className="border-t border-border pt-7 space-y-5">
        <div>
          <h3 className="text-base font-medium text-text-primary">
            Add context <span className="text-text-secondary font-normal text-sm">(optional — improves output quality significantly)</span>
          </h3>
        </div>

        {/* Target audience */}
        <Field label="Target audience">
          <input
            type="text"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="e.g. Coffee lovers, Home bakers, New parents"
            disabled={disabled}
            className={inputCls}
          />
        </Field>

        {/* Brand voice */}
        <Field
          label="Brand voice"
          hint="Saved to your profile when you generate"
        >
          <div className="relative">
            <input
              type="text"
              value={brandVoice}
              onChange={(e) => { setBrandVoice(e.target.value); setVoiceSaved(false) }}
              placeholder="e.g. Warm and minimal, Bold and direct, Playful and fun"
              disabled={disabled}
              className={`${inputCls} pr-28`}
            />
            <button
              type="button"
              onClick={handleSaveBrandVoice}
              disabled={!brandVoice.trim() || savingVoice || disabled}
              className={`
                absolute right-2 top-1/2 -translate-y-1/2
                text-xs font-medium px-3 py-1.5 rounded-lg transition-colors duration-150
                disabled:opacity-40 disabled:cursor-not-allowed
                ${voiceSaved
                  ? 'bg-success-muted text-success border border-success'
                  : 'bg-surface border border-border-2 text-text-secondary hover:text-text-primary hover:border-accent'}
              `}
            >
              {voiceSaved ? 'Saved' : savingVoice ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Field>
      </div>

      {/* ── Credit cost summary and submit ───────────────────────────────────── */}
      <div className="border-t border-border pt-7 space-y-4">

        {/* Credit preview */}
        <div className={`rounded-xl px-5 py-4 border ${
          insufficientCredits
            ? 'bg-error-muted border-error'
            : 'bg-surface border-border'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className={`text-sm font-medium ${
              insufficientCredits ? 'text-error' : 'text-text-primary'
            }`}>
              {insufficientCredits
                ? 'Not enough credits'
                : `This will use ${creditCost} credit${creditCost === 1 ? '' : 's'}`}
            </span>
            <span className="text-text-secondary text-sm font-mono">
              {subscriptionCredits} monthly · {topupCredits} top-up remaining
            </span>
          </div>
          <p className="text-text-secondary text-xs mt-1.5">
            {insufficientCredits
              ? 'Deselect a platform or buy more credits to continue.'
              : `${creditCost} platform${creditCost === 1 ? '' : 's'} selected · 1 credit per platform`}
          </p>
        </div>

        {/* Generate button */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-accent hover:bg-accent-hover text-white font-medium rounded-lg px-5 py-3 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-base"
        >
          {disabled
            ? 'Generating listings…'
            : insufficientCredits
            ? 'Not enough credits'
            : `Generate ${creditCost} listing${creditCost === 1 ? '' : 's'}`}
        </button>
      </div>

    </form>
  )
}
