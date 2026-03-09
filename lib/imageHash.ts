/**
 * Client-side SHA-256 hashing via the Web Crypto API (no dependencies).
 * Used before upload to detect duplicate product images.
 *
 * Must only be called in browser contexts (not in Node/Edge API routes).
 */
export async function hashImageFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Lightweight check: returns true if the Web Crypto API is available.
 * Always true in modern browsers; false in older environments.
 */
export function isCryptoAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.crypto !== 'undefined' &&
    typeof window.crypto.subtle !== 'undefined'
  )
}
