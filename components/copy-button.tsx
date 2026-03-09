'use client'

import { useState, useCallback } from 'react'
import { ClipboardIcon, ClipboardCheckIcon } from 'lucide-react'

interface CopyButtonProps {
  value:        string
  label?:       string
  className?:   string
  iconOnly?:    boolean
}

export default function CopyButton({
  value,
  label    = 'Copy',
  className = '',
  iconOnly  = false,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (copied) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        // Textarea fallback for older browsers
        const ta = document.createElement('textarea')
        ta.value = value
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Silent fail — clipboard access may be denied
    }
  }, [value, copied])

  const Icon = copied ? ClipboardCheckIcon : ClipboardIcon

  if (iconOnly) {
    return (
      <button
        onClick={handleCopy}
        title={copied ? 'Copied!' : label}
        className={`
          p-1.5 rounded transition-colors duration-150
          ${copied
            ? 'text-success'
            : 'text-text-secondary hover:text-text-primary'}
          ${className}
        `}
        aria-label={copied ? 'Copied' : label}
      >
        <Icon className="w-4 h-4" />
      </button>
    )
  }

  return (
    <button
      onClick={handleCopy}
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium
        transition-colors duration-150
        ${copied
          ? 'border-success text-success bg-success-muted'
          : 'border-border-2 text-text-secondary hover:text-text-primary hover:border-accent'}
        ${className}
      `}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      {copied ? 'Copied!' : label}
    </button>
  )
}
