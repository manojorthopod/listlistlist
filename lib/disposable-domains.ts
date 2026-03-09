/**
 * lib/disposable-domains.ts
 *
 * Curated blocklist of known disposable / throwaway email domains.
 *
 * IMPORTANT CONTEXT — why this list is a safety net, not the primary defence:
 *
 * listlistlist uses Google OAuth exclusively. Google requires phone verification
 * for new accounts, which eliminates the vast majority of automated trial abuse.
 * Disposable email services like Mailinator or Guerrilla Mail do NOT support
 * Google OAuth — so users cannot sign up with those addresses directly.
 *
 * What this list catches:
 *   - Edge cases where Clerk allows email/password fallback unexpectedly
 *   - Google Workspace accounts on domains known to issue throwaway addresses
 *   - Future auth changes that introduce email/password alongside OAuth
 *
 * Maintenance:
 *   - Add domains here when abuse patterns are observed in signup logs
 *   - Do NOT add catch-all rules (e.g. blocking all non-gmail.com) — too aggressive
 *   - Prefer logging + monitoring first; block only high-confidence throwaway domains
 */

// All entries lowercase, no leading @, no wildcards
export const DISPOSABLE_DOMAINS = new Set<string>([
  // ── Mailinator family ──────────────────────────────────────────────────────
  'mailinator.com',
  'mailinator2.com',
  'mailinator.net',
  'mailinator.org',
  'mailinater.com',
  'soodonims.com',
  'spamgourmet.com',
  'spamgourmet.net',
  'spamgourmet.org',

  // ── Guerrilla Mail family ──────────────────────────────────────────────────
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamail.de',
  'guerrillamail.info',
  'guerrillamailblock.com',
  'grr.la',
  'spam4.me',
  'yopmail.com',
  'yopmail.fr',
  'cool.fr.nf',
  'jetable.fr.nf',
  'nospam.ze.tc',
  'nomail.xl.cx',

  // ── Temp-mail / 10minutemail ───────────────────────────────────────────────
  'tempmail.com',
  'tempmail.net',
  'tempmail.org',
  'temp-mail.org',
  'temp-mail.io',
  'temp-mail.ru',
  '10minutemail.com',
  '10minutemail.net',
  '10minutemail.org',
  '10minutemail.de',
  '10minutemail.co.uk',
  '10minutemail.ru',
  '10minemail.com',
  '20minutemail.com',
  '33mail.com',

  // ── Throwmail / Fakeinbox ──────────────────────────────────────────────────
  'throwam.com',
  'throwam.net',
  'throwamailaway.com',
  'fakeinbox.com',
  'fakemail.net',
  'fakemailgenerator.com',
  'mailnull.com',
  'spamevader.com',

  // ── Trashmail family ──────────────────────────────────────────────────────
  'trashmail.at',
  'trashmail.com',
  'trashmail.io',
  'trashmail.me',
  'trashmail.net',
  'trashmail.org',
  'trashmail.xyz',
  'trashmail.uk',
  'wegwerfmail.de',
  'wegwerfmail.net',
  'wegwerfmail.org',

  // ── Mailnesia / Mailnull ───────────────────────────────────────────────────
  'mailnesia.com',
  'mailnull.com',
  'maildrop.cc',
  'mailsac.com',
  'dispostable.com',

  // ── Sharklasers / Guerrillamail aliases ────────────────────────────────────
  'sharklasers.com',
  'guerrillamailblock.com',
  'spam4.me',
  'burnermail.io',

  // ── Misc well-known throwaways ────────────────────────────────────────────
  'getairmail.com',
  'filzmail.com',
  'throwam.com',
  'discard.email',
  'discardmail.com',
  'discardmail.de',
  'spamfree24.org',
  'spamfree24.de',
  'spamfree24.eu',
  'spamfree24.info',
  'spamfree24.net',
  'spamfree.eu',
  'nwldx.com',
  'giantmail.de',
  'inoutmail.de',
  'inoutmail.eu',
  'inoutmail.info',
  'inoutmail.net',
  'thankyou2010.com',
  'zetmail.com',
  'objectmail.com',
  'hailmail.net',
  'iroid.com',
  'mytrashmail.com',
  'mt2009.com',
  'mt2014.com',
  'notsharingmy.info',
  'ownmail.net',
  'pecinan.com',
  'pecinan.net',
  'pecinan.org',
  'prtnx.com',
  'putthisinyourspamdatabase.com',
  'safetymail.info',
  'safetypost.de',
  'sandelf.de',
  'teewars.org',
  'urfunktion.de',
  'viditag.com',
  'viewcastmedia.com',
  'viewcastmedia.net',
  'viewcastmedia.org',
  'einrot.de',
  'enterto.com',
  'klzlk.com',
  'binkmail.com',
  'bobmail.info',
  'chammy.info',
  'drdrb.net',
  'dump-email.info',
  'dumpandforfeit.com',
  'dumpmail.de',
  'durandinterstellar.com',
  'e4ward.com',
  'email60.com',
  'emailias.com',
  'emailinfive.com',
  'emailmiser.com',
  'emailsensei.com',
  'emailtemporario.com.br',
  'emailto.de',
  'emailwarden.com',
  'emailx.at.hm',
  'emailxfer.com',
  'emkei.cz',
])

/**
 * Additional suspicious TLD patterns — domains using these TLDs combined with
 * generic names are often temporary. Only used as a secondary signal, never
 * to block alone.
 */
export const SUSPICIOUS_TLDS = new Set<string>([
  '.xyz',      // common for burner domains
  '.ml',       // frequent abuse
  '.ga',       // frequent abuse
  '.cf',       // frequent abuse
  '.gq',       // frequent abuse
  '.tk',       // Tokelau — historically very abused
])
