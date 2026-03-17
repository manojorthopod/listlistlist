'use client'

// ─── Platform SVG logos ───────────────────────────────────────────────────────
// Each renders at 22×22. Paths derived from Simple Icons (CC0 licence).

function AmazonIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      {/* smile arrow */}
      <path
        fill="#FF9900"
        d="M16.68 14.04c-.18.13-.43.14-.63.05C14 12.7 13.7 12.1 12.63 10.7c-1.28 1.3-2.19 1.68-3.85 1.68-1.96 0-3.5-1.2-3.5-3.62 0-1.89.97-3.17 2.44-3.8 1.26-.55 2.96-.64 4.27-.77V3.73c0-.54.05-1.18-.28-1.64-.3-.43-.88-.61-1.38-.61-.94 0-1.77.47-1.98 1.46L6.29 2.7C6.77 0 9.33-.83 11.66-.83c1.2 0 2.78.32 3.73 1.24 1.2 1.12 1.08 2.61 1.08 4.23v4.26c0 1.28.53 1.84.98 2.53.17.24.2.52-.01.68l-2.76 2.07v.06zM13 9.6V8.8c-2.1 0-3.66.57-3.66 2.2 0 .95.5 1.59 1.35 1.59.63 0 1.18-.39 1.54-1.02C12.7 10.7 13 9.97 13 9.6z"
      />
      <path
        fill="#FF9900"
        d="M5.94 19.3C7.8 20.47 10.1 21.1 12 21.1c1.9 0 4.2-.63 6.06-1.8.24-.15.46.1.24.29C16.3 21.23 14.15 22 12 22c-2.15 0-4.3-.77-6.3-2.41-.22-.19 0-.44.24-.29z"
      />
    </svg>
  )
}

function EtsyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="#F56400"
        d="M5.5 3h13v3H9v4.25h7v3H9V18h9.5v3h-13V3z"
      />
    </svg>
  )
}

function EbayIcon() {
  // eBay's logo is their 4 overlapping coloured letters
  return (
    <svg width="44" height="22" viewBox="0 0 56 24" fill="none" aria-hidden>
      {/* e — red */}
      <path
        fill="#E53238"
        d="M7 12c0-3.87 3.13-7 7-7 3.54 0 6.46 2.63 6.94 6H11.1a3 3 0 0 1 2.9-2.2c1.22 0 2.27.73 2.74 1.78L20 9.1C18.94 7.22 16.82 6 14 6a6 6 0 1 0 6 6v-.5H7v.5c0-3.87 0-3.87 0 0zM14 16a3 3 0 0 1-2.83-2H20v.5C19.73 17.42 17.07 18 14 18z"
      />
      {/* b — blue */}
      <path
        fill="#0064D2"
        d="M22 3h3v7.2A5 5 0 0 1 29 9c2.76 0 5 2.24 5 5s-2.24 5-5 5a5 5 0 0 1-4-2v1.5h-3V3zm7 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"
      />
      {/* a — yellow */}
      <path
        fill="#F5AF02"
        d="M40 9c-2.76 0-5 2.24-5 5s2.24 5 5 5c1.19 0 2.28-.42 3.13-1.11L43.5 19h2.5v-5c0-2.76-2.24-5-5-5zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"
      />
      {/* y — green */}
      <path
        fill="#86B817"
        d="M47 9.5h3.3l2.7 4.5 2.7-4.5H59L54 18l-1 2c-.5 1-1.5 1.5-2.5 1.5H49v-2.5h1c.5 0 .8-.2 1-.5l.2-.5L47 9.5z"
      />
    </svg>
  )
}

function ShopifyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="#96BF48"
        d="M15.34 3.93a.34.34 0 0 0-.3-.28c-.12-.01-2.55-.19-2.55-.19s-1.7-1.67-1.87-1.84a.44.44 0 0 0-.37-.08L9.3 2 8.5.82A3.8 3.8 0 0 0 5.8 0C5.68 0 5.55.01 5.43.04L5.1 0C3.38 0 2.56 2.18 2.3 3.29l-1.95.6C.04 4 0 4.06 0 4.37L.88 21l12.2 2.14L16.9 22 15.34 3.93zm-4.36-1.8.94-.28c0 .24.01.52.03.85l-1.96.6c.38-1.5.99-1.17.99-1.17zm-.42 1.92v.14l-2.74.85c.54-2.07 1.55-3.07 2.4-3.5.28.65.34 1.65.34 2.51zm-1.15-4.1c.16 0 .31.05.44.16l-.56 1.69C8.63 1.34 7.85 2.6 7.62 3.86l-1.88.58c.3-1.5 1.64-4.49 3.67-4.49zM9.1 15.38l-3.26-1 .87-4.38 2.39 3.38V15.38zm-1.18-5.8L5.07 5.4l5.65-1.74c.6 2.33.12 4.57-.92 5.59L7.92 9.58z"
      />
    </svg>
  )
}

function WooCommerceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="#7F54B3"
        d="M3.37 0C1.51 0 0 1.51 0 3.37v12.79c0 1.86 1.51 3.37 3.37 3.37h7.81l3.49 4.47 3.49-4.47h2.47c1.86 0 3.37-1.51 3.37-3.37V3.37C24 1.51 22.49 0 20.63 0H3.37zm2.12 5.31h1.97l1.66 7.37 2.3-5.37c.2-.47.49-.7.85-.7.36 0 .65.23.85.7l2.3 5.37 1.66-7.37h1.97l-2.7 10.07c-.22.82-.59 1.22-1.1 1.22-.35 0-.66-.11-.91-.34a3.1 3.1 0 0 1-.64-.99l-2.43-5.73-2.43 5.73c-.23.54-.47.86-.64.99-.25.23-.56.34-.91.34-.51 0-.88-.41-1.1-1.22L5.49 5.31z"
      />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="#000000"
        d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.19 8.19 0 004.79 1.53V6.75a4.85 4.85 0 01-1.02-.06z"
      />
    </svg>
  )
}

// ─── Platform data ────────────────────────────────────────────────────────────

const PLATFORMS = [
  { name: 'Amazon',      Icon: AmazonIcon,      wide: false },
  { name: 'Etsy',        Icon: EtsyIcon,        wide: false },
  { name: 'eBay',        Icon: EbayIcon,        wide: true  },
  { name: 'Shopify',     Icon: ShopifyIcon,     wide: false },
  { name: 'WooCommerce', Icon: WooCommerceIcon, wide: false },
  { name: 'TikTok Shop', Icon: TikTokIcon,      wide: false },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlatformRow() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-8">
      {PLATFORMS.map(({ name, Icon, wide }) => (
        <div key={name} className="flex items-center gap-2.5 opacity-70 hover:opacity-100 transition-opacity duration-150 cursor-default">
          <span className={`flex items-center justify-center ${wide ? 'w-11' : 'w-6'} h-6 flex-shrink-0`}>
            <Icon />
          </span>
          <span className="text-sm text-text-secondary font-medium whitespace-nowrap">
            {name}
          </span>
        </div>
      ))}
    </div>
  )
}
