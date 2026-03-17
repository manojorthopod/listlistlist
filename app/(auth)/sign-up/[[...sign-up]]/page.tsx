import { SignUp } from '@clerk/nextjs'
import Link from 'next/link'

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-block">
            <img src="/logo.svg" alt="listlistlist" style={{ height: '40px', width: 'auto' }} />
          </Link>
          <p className="mt-2 text-text-secondary text-sm">
            Start your 7-day free trial — 10 credits, no card required
          </p>
        </div>
        <SignUp
          fallbackRedirectUrl="/dashboard"
          appearance={{
            variables: {
              colorBackground:      '#FFFFFF',
              colorInputBackground: '#F4F3F0',
              colorInputText:       '#1A1814',
              colorText:            '#1A1814',
              colorTextSecondary:   '#6B6760',
              colorPrimary:         '#5B4FE8',
              colorDanger:          '#D94F4F',
              borderRadius:         '8px',
              fontFamily:           'var(--font-geist-sans), Inter, sans-serif',
            },
            elements: {
              card:                      'bg-white border border-border shadow-card',
              headerTitle:               'hidden',
              headerSubtitle:            'hidden',
              socialButtonsBlockButton:
                'border border-border hover:border-border-2 hover:bg-surface-2 text-text-primary font-medium rounded-lg transition-colors duration-150 bg-white',
              dividerLine:               'bg-border',
              dividerText:               'text-text-secondary text-xs',
              formFieldInput:
                'bg-surface-2 border border-border focus:border-accent rounded-lg text-text-primary placeholder:text-text-disabled outline-none',
              formFieldLabel:            'text-text-secondary text-sm font-medium',
              formButtonPrimary:
                'bg-[#1A1814] hover:bg-[#2D2A25] text-white font-medium rounded-lg transition-colors duration-150',
              footerActionLink:          'text-accent hover:text-accent-hover',
              identityPreviewText:       'text-text-primary',
              identityPreviewEditButton: 'text-accent',
            },
          }}
        />
      </div>
    </div>
  )
}
