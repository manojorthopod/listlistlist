'use client'

import { useState } from 'react'
import { useClerk } from '@clerk/nextjs'

interface SignOutButtonProps {
  variant?: 'subtle' | 'primary'
  className?: string
}

export default function SignOutButton({
  variant = 'subtle',
  className = '',
}: SignOutButtonProps) {
  const { signOut } = useClerk()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    if (loading) return
    setLoading(true)
    try {
      await signOut({ redirectUrl: '/' })
    } finally {
      setLoading(false)
    }
  }

  if (variant === 'primary') {
    return (
      <button
        onClick={handleSignOut}
        disabled={loading}
        className={`
          inline-flex items-center justify-center
          bg-accent hover:bg-accent-hover text-white font-medium
          rounded-lg px-4 py-2.5 text-sm
          transition-colors duration-150
          disabled:opacity-40 disabled:cursor-not-allowed
          ${className}
        `}
      >
        {loading ? 'Signing out…' : 'Sign out'}
      </button>
    )
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className={`
        text-sm text-[#6B6760] hover:text-text-primary transition-colors duration-150
        disabled:opacity-40 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
