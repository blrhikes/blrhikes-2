import type { EmailAdapter } from 'payload'

// Minimal Resend adapter that calls the HTTPS API directly.
// Avoids pulling in nodemailer + the full Resend SDK (both ship heavy deps
// that bloat the Workers bundle).
//
// Env vars read at send time:
//   RESEND_API_KEY   required  — the bearer token
//   RESEND_FROM      optional  — override the default from address
//   RESEND_FROM_NAME optional  — override the default from name
//
// Set RESEND_API_KEY as a secret on each CMS worker env (test / live).
// The other two are optional — fall back to the FALLBACK_* constants below.
//
// Before this adapter actually sends: verify the sending domain in Resend
// (add SPF + DKIM records on blrhikes.in). Without that, Resend returns 403.

type ResendPayload = {
  from: string
  to: string[]
  subject: string
  html?: string
  text?: string
  reply_to?: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
}

export const FALLBACK_FROM_ADDRESS = 'hello@send.blrhikes.in'
export const FALLBACK_FROM_NAME = 'BLR Hikes'

export async function sendViaResend(apiKey: string, message: ResendPayload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend ${res.status}: ${body}`)
  }
  return (await res.json()) as { id: string }
}

const toArray = (v: string | string[] | undefined): string[] => {
  if (!v) return []
  return Array.isArray(v) ? v.map(String) : [String(v)]
}

export const resendAdapter = (): EmailAdapter =>
  ({ payload }) => ({
    name: 'resend',
    defaultFromAddress: process.env.RESEND_FROM || FALLBACK_FROM_ADDRESS,
    defaultFromName: process.env.RESEND_FROM_NAME || FALLBACK_FROM_NAME,
    sendEmail: async (message) => {
      const apiKey = process.env.RESEND_API_KEY

      // Build/deploy is not blocked by a missing key — only the actual
      // send fails, and we swallow that too so a missing config doesn't
      // crash user-visible requests (forgot-password etc.). The caller
      // still gets a fake id back so Payload's flow keeps going.
      if (!apiKey) {
        payload.logger.warn(
          { to: message.to, subject: message.subject },
          '[resend] RESEND_API_KEY not set — skipping send. Configure the secret on the CMS worker to enable outbound email.',
        )
        return { id: 'skipped-no-api-key' }
      }

      const fromAddress = process.env.RESEND_FROM || FALLBACK_FROM_ADDRESS
      const fromName = process.env.RESEND_FROM_NAME || FALLBACK_FROM_NAME
      const from =
        typeof message.from === 'string' ? message.from : `${fromName} <${fromAddress}>`

      const result = await sendViaResend(apiKey, {
        from,
        to: toArray(message.to as string | string[]),
        subject: String(message.subject ?? ''),
        html: typeof message.html === 'string' ? message.html : undefined,
        text: typeof message.text === 'string' ? message.text : undefined,
        reply_to: message.replyTo as string | string[] | undefined,
        cc: message.cc as string | string[] | undefined,
        bcc: message.bcc as string | string[] | undefined,
      })
      return { id: result.id }
    },
  })
