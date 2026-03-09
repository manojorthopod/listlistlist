import { Resend } from 'resend'

function getResendClient() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('Missing RESEND_API_KEY environment variable')
  return new Resend(key)
}

export const resend = getResendClient()

const FROM_ADDRESS = 'listlistlist <hello@listlistlist.co>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://listlistlist.co'

// ─── Shared email shell ───────────────────────────────────────────────────────

function emailShell(body: string, creditBalance: number): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>listlistlist</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0F;font-family:Inter,sans-serif;color:#F8F8FF;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0F;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Wordmark -->
          <tr>
            <td style="padding-bottom:32px;">
              <span style="font-family:monospace;font-size:20px;font-weight:700;color:#F8F8FF;letter-spacing:-0.5px;">
                listlistlist
              </span>
            </td>
          </tr>

          <!-- Body card -->
          <tr>
            <td style="background:#13131A;border:1px solid #222230;border-radius:12px;padding:32px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#8888AA;line-height:1.6;">
                You have <strong style="color:#F8F8FF;">${creditBalance} credit${creditBalance === 1 ? '' : 's'}</strong> remaining.
                &nbsp;·&nbsp;
                <a href="${APP_URL}/account" style="color:#7C3AED;text-decoration:none;">Manage account</a>
                &nbsp;·&nbsp;
                <a href="${APP_URL}/pricing" style="color:#7C3AED;text-decoration:none;">View plans</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const h2 = 'margin:0 0 16px;font-size:22px;font-weight:700;color:#F8F8FF;line-height:1.3;'
const p  = 'margin:0 0 16px;font-size:15px;color:#F8F8FF;line-height:1.6;'
const ps = 'margin:0 0 16px;font-size:13px;color:#8888AA;line-height:1.6;'
const cta = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#7C3AED;color:#fff;font-weight:600;font-size:15px;text-decoration:none;padding:12px 24px;border-radius:8px;margin-top:8px;">${label}</a>`

// ─── Day 0 — Welcome ─────────────────────────────────────────────────────────

export async function sendWelcomeEmail(
  to: string,
  creditBalance: number
): Promise<void> {
  const body = `
    <h2 style="${h2}">You're in — here's how to get your first listing in 3 minutes</h2>
    <p style="${p}">
      listlistlist turns a single product photo into optimised listings for Amazon, Etsy, eBay,
      Shopify, WooCommerce, and TikTok Shop. Upload once, copy-paste everywhere.
    </p>
    <p style="${p}">
      <strong>Tip:</strong> a clean, well-lit photo on a plain background gives the best results.
      The AI reads the image directly — good lighting means better data.
    </p>
    <p style="${p}">
      You have <strong>${creditBalance} credits</strong> in your 7-day trial.
      That's up to ${creditBalance} platform listings — one credit per platform per generation.
    </p>
    ${cta(`${APP_URL}/generate`, 'Generate your first listing →')}
  `

  await resend.emails.send({
    from:    FROM_ADDRESS,
    to,
    subject: "You're in — here's how to get your first listing in 3 minutes",
    html:    emailShell(body, creditBalance),
  })
}

// ─── Day 2 — Feature tip ─────────────────────────────────────────────────────

export async function sendDay2TipEmail(
  to: string,
  creditBalance: number
): Promise<void> {
  const body = `
    <h2 style="${h2}">A tip most sellers miss on their first listing</h2>
    <p style="${p}">
      On the confirmation screen, there are two fields that make a significant difference
      to output quality: <strong>Target Audience</strong> and <strong>Brand Voice</strong>.
    </p>
    <p style="${p}">Most people skip them. Here's why you shouldn't:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="background:#1C1C28;border:1px solid #222230;border-radius:8px;padding:16px;font-size:13px;color:#8888AA;line-height:1.6;">
          <strong style="color:#F43F5E;display:block;margin-bottom:6px;">Without brand voice:</strong>
          "Handmade ceramic mug, holds 12oz. Great for coffee or tea. Made with care."
        </td>
      </tr>
      <tr><td style="height:8px;"></td></tr>
      <tr>
        <td style="background:#1C1C28;border:1px solid #10B981;border-radius:8px;padding:16px;font-size:13px;color:#F8F8FF;line-height:1.6;">
          <strong style="color:#10B981;display:block;margin-bottom:6px;">With brand voice "warm and minimal":</strong>
          "The mug that makes mornings worth getting up for. Wheel-thrown stoneware, 12oz,
          wide enough for a proper flat white. No fuss. Just a good cup."
        </td>
      </tr>
    </table>
    <p style="${ps}">Same product. Completely different listing.</p>
    ${cta(`${APP_URL}/generate`, 'Try it now →')}
  `

  await resend.emails.send({
    from:    FROM_ADDRESS,
    to,
    subject: 'A tip most sellers miss on their first listing',
    html:    emailShell(body, creditBalance),
  })
}

// ─── Day 5 — Trial nudge ─────────────────────────────────────────────────────

export async function sendDay5NudgeEmail(
  to: string,
  creditBalance: number
): Promise<void> {
  const body = `
    <h2 style="${h2}">2 days left in your trial — don't lose your listings</h2>
    <p style="${p}">
      Your 7-day trial ends in 2 days. All listings you've generated during the trial
      remain accessible after you subscribe — nothing gets deleted.
    </p>
    <table width="100%" cellpadding="16" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="background:#1C1C28;border:1px solid #222230;border-radius:8px;width:50%;vertical-align:top;padding:16px;">
          <strong style="font-size:15px;color:#F8F8FF;">Starter</strong>
          <div style="font-size:24px;font-weight:700;color:#F8F8FF;margin:8px 0;">£39<span style="font-size:14px;font-weight:400;color:#8888AA;">/mo</span></div>
          <div style="font-size:13px;color:#8888AA;">50 credits/month · All 6 platforms</div>
        </td>
        <td style="width:16px;"></td>
        <td style="background:#1C1C28;border:1px solid #7C3AED;border-radius:8px;width:50%;vertical-align:top;padding:16px;">
          <strong style="font-size:15px;color:#F8F8FF;">Pro</strong>
          <div style="font-size:24px;font-weight:700;color:#F8F8FF;margin:8px 0;">£79<span style="font-size:14px;font-weight:400;color:#8888AA;">/mo</span></div>
          <div style="font-size:13px;color:#8888AA;">1,000 credits/month · Priority generation</div>
        </td>
      </tr>
    </table>
    ${cta(`${APP_URL}/pricing`, 'Upgrade now and keep everything →')}
    <p style="${ps};margin-top:16px;">
      Or — <a href="${APP_URL}/generate" style="color:#7C3AED;text-decoration:none;">generate one more listing before your trial ends →</a>
    </p>
  `

  await resend.emails.send({
    from:    FROM_ADDRESS,
    to,
    subject: "2 days left in your trial — don't lose your listings",
    html:    emailShell(body, creditBalance),
  })
}

// ─── Day 7 — Trial expiry ─────────────────────────────────────────────────────

export async function sendTrialExpiredEmail(
  to: string,
  referralLink: string
): Promise<void> {
  const body = `
    <h2 style="${h2}">Your listlistlist trial has ended</h2>
    <p style="${p}">
      Your 7-day trial has ended and you can no longer generate listings.
      Your saved listings are still in your dashboard — they're not going anywhere.
    </p>
    <p style="${p}">
      Whenever you're ready, pick a plan and carry on where you left off.
    </p>
    ${cta(`${APP_URL}/pricing`, 'Choose a plan →')}
    <p style="${ps};margin-top:20px;">
      Not ready yet? Refer a friend and earn 10 free credits when they subscribe.<br/>
      Your referral link: <a href="${referralLink}" style="color:#7C3AED;text-decoration:none;">${referralLink}</a>
    </p>
  `

  await resend.emails.send({
    from:    FROM_ADDRESS,
    to,
    subject: 'Your listlistlist trial has ended',
    html:    emailShell(body, 0),
  })
}

// ─── Low credits alert ────────────────────────────────────────────────────────

export async function sendLowCreditsEmail(
  to: string,
  creditBalance: number,
  renewalDate: string
): Promise<void> {
  const body = `
    <h2 style="${h2}">You're running low on credits</h2>
    <p style="${p}">
      You have <strong>${creditBalance} credit${creditBalance === 1 ? '' : 's'}</strong> left this month.
    </p>
    <p style="${p}">Your options:</p>
    <ul style="margin:0 0 16px;padding-left:20px;color:#F8F8FF;font-size:15px;line-height:1.8;">
      <li>Upgrade to Pro for 1,000 credits/month</li>
      <li>Buy a top-up pack (credits never expire)</li>
      <li>Wait for your credits to reset on ${renewalDate}</li>
    </ul>
    ${cta(`${APP_URL}/account`, 'Buy more credits →')}
  `

  await resend.emails.send({
    from:    FROM_ADDRESS,
    to,
    subject: "You're running low on credits",
    html:    emailShell(body, creditBalance),
  })
}
