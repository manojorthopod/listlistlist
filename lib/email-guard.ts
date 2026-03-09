/**
 * lib/email-guard.ts
 *
 * Utilities for checking whether an email address belongs to a known
 * disposable / throwaway domain.
 *
 * Design notes:
 *   - All checks are synchronous and offline (no third-party API calls).
 *   - The primary defence against trial abuse is Google OAuth + phone
 *     verification. This module is a secondary, belt-and-braces check.
 *   - False-positive risk is intentionally minimised: we only block on
 *     high-confidence domain matches, never on heuristics alone.
 */

import { DISPOSABLE_DOMAINS, SUSPICIOUS_TLDS } from '@/lib/disposable-domains'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmailGuardResult =
  | { blocked: true;  reason: string; domain: string; confidence: 'high' | 'low' }
  | { blocked: false; domain: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts and normalises the domain from an email address.
 * Returns null if the email is malformed.
 */
export function extractDomain(email: string): string | null {
  const parts = email.toLowerCase().trim().split('@')
  if (parts.length !== 2 || !parts[1] || !parts[1].includes('.')) return null
  return parts[1]
}

/**
 * Returns true if the domain matches a known disposable domain exactly.
 * Does NOT do wildcard or subdomain matching to avoid false positives.
 */
export function isKnownDisposableDomain(domain: string): boolean {
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase())
}

/**
 * Returns true if the domain's TLD is in the suspicious-TLD list.
 * Only used as a low-confidence secondary signal — never blocks alone.
 */
export function hasSuspiciousTld(domain: string): boolean {
  const lower = domain.toLowerCase()
  return Array.from(SUSPICIOUS_TLDS).some((tld) => lower.endsWith(tld))
}

/**
 * Main guard function. Returns a structured result indicating whether
 * the email should be blocked and why.
 *
 * Policy:
 *   - BLOCK (high confidence): domain is in the DISPOSABLE_DOMAINS set
 *   - ALLOW with low-confidence flag: domain has a suspicious TLD only
 *   - ALLOW: everything else (including all @gmail.com, @googlemail.com,
 *     and Google Workspace domains)
 */
export function checkEmail(email: string): EmailGuardResult {
  const domain = extractDomain(email)

  if (!domain) {
    // Malformed email — let Clerk's own validation handle this
    return { blocked: false, domain: email }
  }

  if (isKnownDisposableDomain(domain)) {
    return {
      blocked:    true,
      reason:     'Please sign up with a permanent email address.',
      domain,
      confidence: 'high',
    }
  }

  // Suspicious TLD — flag for logging but do NOT block.
  // Google OAuth already requires phone verification; we don't want to
  // block legitimate custom-domain Google Workspace accounts.
  if (hasSuspiciousTld(domain)) {
    return {
      blocked:    false,   // log the suspicion but allow
      domain,
    }
  }

  return { blocked: false, domain }
}

// ─── Logging helpers ──────────────────────────────────────────────────────────

/**
 * Structured signup event for monitoring. Always logged on every new user —
 * not just suspicious ones. This gives us a complete picture of signup patterns.
 */
export interface SignupLogEntry {
  userId:        string
  email:         string
  domain:        string
  provider:      string          // e.g. 'google', 'email'
  isDisposable:  boolean
  isSuspiciousTld: boolean
  blocked:       boolean
  timestamp:     string          // ISO 8601
}

export function buildSignupLogEntry(
  userId:   string,
  email:    string,
  provider: string
): SignupLogEntry {
  const domain = extractDomain(email) ?? email
  return {
    userId,
    email,
    domain,
    provider,
    isDisposable:    isKnownDisposableDomain(domain),
    isSuspiciousTld: hasSuspiciousTld(domain),
    blocked:         isKnownDisposableDomain(domain),
    timestamp:       new Date().toISOString(),
  }
}
