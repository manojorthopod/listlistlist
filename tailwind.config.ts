import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'base':        '#0A0A0F',
        'surface':     '#13131A',
        'surface-2':   '#1C1C28',
        'border':      '#222230',
        'border-2':    '#2E2E42',

        // Brand accent
        'accent':       '#7C3AED',
        'accent-hover': '#6D28D9',
        'accent-light': '#8B5CF6',
        'accent-muted': '#7C3AED26',

        // Text
        'text-primary':   '#F8F8FF',
        'text-secondary': '#8888AA',
        'text-disabled':  '#44445A',

        // Semantic
        'success':       '#10B981',
        'success-muted': '#10B98120',
        'warning':       '#F59E0B',
        'warning-muted': '#F59E0B20',
        'error':         '#F43F5E',
        'error-muted':   '#F43F5E20',

        // Platform accent colours
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
    },
  },
  plugins: [],
}

export default config
