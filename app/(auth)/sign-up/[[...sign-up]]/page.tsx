import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-text-primary font-mono">
            listlistlist
          </h1>
          <p className="mt-2 text-text-secondary text-sm">
            Start your 7-day free trial — 10 credits, no card required
          </p>
        </div>
        <SignUp
          fallbackRedirectUrl="/dashboard"
          appearance={{
            variables: {
              colorBackground:       '#13131A',
              colorInputBackground:  '#1C1C28',
              colorInputText:        '#F8F8FF',
              colorText:             '#F8F8FF',
              colorTextSecondary:    '#8888AA',
              colorPrimary:          '#7C3AED',
              colorDanger:           '#F43F5E',
              borderRadius:          '8px',
              fontFamily:            'var(--font-geist-sans), Inter, sans-serif',
            },
            elements: {
              card:               'bg-surface border border-border shadow-none',
              headerTitle:        'hidden',
              headerSubtitle:     'hidden',
              socialButtonsBlockButton:
                'border border-border-2 hover:border-accent text-text-primary font-medium rounded-lg transition-colors duration-150 bg-surface-2',
              dividerLine:        'bg-border',
              dividerText:        'text-text-secondary text-xs',
              formFieldInput:
                'bg-surface-2 border border-border focus:border-accent focus:ring-1 focus:ring-accent/30 rounded-lg text-text-primary placeholder:text-text-disabled outline-none',
              formFieldLabel:     'text-text-secondary text-sm',
              formButtonPrimary:
                'bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg transition-colors duration-150',
              footerActionLink:   'text-accent hover:text-accent-light',
              identityPreviewText: 'text-text-primary',
              identityPreviewEditButton: 'text-accent',
            },
          }}
        />
      </div>
    </div>
  )
}
