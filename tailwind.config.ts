import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'base':        '#FAFAF8',
        'surface':     '#FFFFFF',
        'surface-2':   '#F4F3F0',
        'border':      '#E8E6E1',
        'border-2':    '#D4D1CB',

        // Brand accent — violet, slightly muted from the dark-mode version
        'accent':       '#5B4FE8',
        'accent-hover': '#4A3FD4',
        'accent-light': '#EEF0FF',
        'accent-muted': '#EEF0FF',

        // Text
        'text-primary':   '#1A1814',
        'text-secondary': '#6B6760',
        'text-disabled':  '#A8A49E',

        // Semantic
        'success':       '#3D9970',
        'success-muted': '#E8F5EE',
        'warning':       '#E8A838',
        'warning-muted': '#FEF6E8',
        'error':         '#D94F4F',
        'error-muted':   '#FDEFEE',

        // Platform accent colours — unchanged, used subtly
        'platform-amazon':  '#FF9900',
        'platform-etsy':    '#F1641E',
        'platform-ebay':    '#E53238',
        'platform-shopify': '#96BF48',
        'platform-woo':     '#7F54B3',
        'platform-tiktok':  '#FF004F',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Inter', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        base: ['15px', { lineHeight: '1.6' }],
      },
      boxShadow: {
        'card':       '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)',
        'focus':      '0 0 0 3px rgba(91,79,232,0.12)',
      },
      maxWidth: {
        'content': '1100px',
      },
    },
  },
  plugins: [],
}

export default config
