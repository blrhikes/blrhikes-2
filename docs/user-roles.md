# User Roles & Access Control

## Roles

| Role | Gated field access | CMS admin | Expiry |
|------|-------------------|-----------|--------|
| `admin` | Yes | Yes (full control) | Never |
| `contributor` | Yes | Yes (can edit trails) | Never |
| `lifetime` | Yes | No | Never |
| `yearly` | Yes | No | 12 months from payment date, immediate cutoff |

First user created gets `admin` automatically. All others default to `lifetime` (set by Razorpay webhook on payment).

## Gated Fields (on Trails)

- `gps` — trailhead coordinates
- `mapLink` — GaiaGPS link
- `gpxFile` — GPX track file

Access enforced at CMS field level: `read: ({ req }) => !!req.user` with role + expiry checks. Anonymous users don't see these fields in API responses.

## Individual Trail Purchases

Users can buy access to a single trail without a membership. Stored as an array of trail IDs on the User document (`trailPurchases` field). Field-level access on gated fields checks: user has a valid membership OR the trail ID is in their `trailPurchases`.

## User Fields

| Field | Type | Notes |
|-------|------|-------|
| `email` | text | Built-in from Payload auth |
| `role` | select | `admin`, `contributor`, `lifetime`, `yearly` |
| `phone` | text | From Razorpay payment notes |
| `firstName` | text | |
| `membershipExpiresAt` | date | Only set for `yearly` role. Null = no expiry |
| `trailPurchases` | relationship (hasMany) | Array of trail IDs bought individually |
| `paymentSource` | text | `razorpay` or `manual` |

## Razorpay Webhook Integration

Custom Payload endpoint: `POST /api/rzp-webhook` (replaces old Vercel serverless + Supabase setup).

### Flow

```
User pays on blrhikes.com
  → Razorpay fires order.paid webhook to cms.blrhikes.com/api/rzp-webhook
  → Verify signature (HMAC-SHA256 with RZP_WEBHOOK_SECRET)
  → Extract email, variant/reason, phone, amount from payment
  → Log payment (Payments collection)
  → Route by variant:
     a. Membership (lifetime/yearly)
        → Find or create user by email
        → Set role to lifetime or yearly
        → Set membershipExpiresAt if yearly (now + 12 months)
        → Send onboarding email
     b. Trail purchase (reason starts with "trail-")
        → Find or create user by email
        → Add trail ID to user's trailPurchases array
        → Send trail purchase email
     c. Event purchase
        → Deferred until Events collection exists
```

### Signature Verification

```
HMAC-SHA256(JSON.stringify(requestBody), RZP_WEBHOOK_SECRET)
```

Compare against `X-Razorpay-Signature` header. Return 200 even on failure (avoids Razorpay retry storms).

## Collections Needed

- **Users** — extended with role, membership, trail purchases (exists, implemented)
- **Payments** — log of all Razorpay payments (not yet created)

## Local Dev

- Cookie domain is `undefined` in dev (scoped to localhost)
- FE login action constructs cookie from Payload's JWT response
- FE worker forwards cookie server-to-server to CMS

## Deferred / TODO

- [ ] Event attendee access (needs Events collection first)
- [ ] Yearly → lifetime upgrade path
- [ ] Razorpay renewal/subscription handling (auto-renewal for yearly)
- [ ] Email sending via Resend (onboarding, trail purchase confirmation)
- [ ] Discount codes
- [ ] Temporary access codes for events (no login required)
