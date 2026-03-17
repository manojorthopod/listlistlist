'use client'

const PLATFORMS = [
  { name: 'Amazon',      color: '#FF9900' },
  { name: 'Etsy',        color: '#F1641E' },
  { name: 'eBay',        color: '#E53238' },
  { name: 'Shopify',     color: '#96BF48' },
  { name: 'WooCommerce', color: '#7F54B3' },
  { name: 'TikTok Shop', color: '#FF004F' },
]

export default function PlatformRow() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      {PLATFORMS.map((p) => (
        <div
          key={p.name}
          className="group flex items-center gap-2 cursor-default"
          title={p.name}
        >
          <span
            className="w-3 h-3 rounded-full transition-all duration-150"
            style={{ background: '#44445A' }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLSpanElement).style.background = p.color
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLSpanElement).style.background = '#44445A'
            }}
          />
          <span className="text-sm text-text-disabled group-hover:text-text-secondary transition-colors duration-150 font-medium">
            {p.name}
          </span>
        </div>
      ))}
    </div>
  )
}
