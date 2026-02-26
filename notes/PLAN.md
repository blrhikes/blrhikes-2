# BLR Hikes - Build Plan

## Tech Stack
- **Frontend:** React Router v7 (SSR) + TailwindCSS
- **Backend:** PayloadCMS (headless CMS)
- **Database:** Cloudflare D1 (SQLite)
- **Hosting:** Cloudflare Workers
- **Email:** Resend
- **Payments:** TBD (Razorpay recommended for India)

## Data Models

| Collection | Key Fields |
|------------|------------|
| **Trails** | title, slug, location, difficulty, features (pet-friendly, lake, waterfall, etc.), content, media, GPX files, access level (free/basic/premium) |
| **Users** | email, name, tier (free/basic/premium), payment status, WhatsApp number, subscription expiry |
| **Events** | title, type (hike/workshop/etc.), date, location, access level, max participants, registrations |
| **Blog** | standard blog fields, author, SEO |
| **Payments** | user ref, amount, transaction ID, tier purchased, status |

## Access Tiers
- **Free:** Well-known trails, free events, blog
- **Basic (₹2699):** 20 secret trails, lifetime updates, community access
- **Premium (₹3799):** 30+ trails, all community perks, exclusive events & workshops

## Routes
```
/                 → Homepage (public)
/trails           → Trail listing (public, limited info)
/trails/[slug]    → Trail detail (gated)
/events           → Events listing
/events/[slug]    → Event detail & registration
/community        → Community page (gated)
/blog             → Blog listing
/blog/[slug]      → Blog post
/pricing          → Pricing tiers
/checkout         → Payment flow
/dashboard        → User dashboard
/admin            → PayloadCMS admin
/login, /signup   → Auth pages
```

## Build Phases

### Phase 1: Foundation
- [x] Project setup (React Router v7 + Cloudflare Workers + D1) — pnpm monorepo with apps/cms, apps/fe, packages/shared
- [x] PayloadCMS with Users, Media & Trails collections — scaffolded from official `with-cloudflare-d1` template
- [x] Homepage, trail listing, trail detail pages — routes at `/`, `/trails`, `/trails/:slug`
- [x] Basic styling with Tailwind
- [x] Migration script (`scripts/migrate.ts`) — GitHub Issues → PayloadCMS
- [ ] Run migration against live CMS (pending CMS running)
- [ ] Component showcase / design page
- [ ] Deploy to Cloudflare Workers (D1 database ID, R2 bucket, custom domains)

### Phase 1.5: Polish & Dark Mode
- [x] Apply Stone + Tiempos design to frontend (light mode)
- [ ] Dark mode support (prefers-color-scheme + toggle)
- [ ] Component showcase / Storybook

### Phase 2: Auth & Access Control
- [ ] Authentication (email/password)
- [ ] User dashboard
- [ ] Content gating based on tier
- [ ] Remaining collections (Events, Blog, Payments)

### Phase 3: Payments
- [ ] Payment gateway integration
- [ ] Checkout flow for both tiers
- [ ] Webhook handling & user tier update
- [ ] Confirmation emails via Resend

### Phase 4: Events & Community
- [ ] Events listing & detail pages
- [ ] Event registration system
- [ ] Community page with WhatsApp group access
- [ ] Blog section

### Phase 5: Launch Prep
- [ ] Content migration (all 30+ trails)
- [ ] GPX file handling & map integration
- [ ] SEO optimization
- [ ] Testing & bug fixes
- [ ] Production deployment

## Open Questions
1. Payment gateway: Razorpay or Stripe?
2. One-time payment or recurring subscription?
3. WhatsApp automation: manual or automated invites?
4. GPX storage: Cloudflare R2 or D1?
5. Maps: Mapbox, Google Maps, or Leaflet?
6. Analytics: GA, Plausible, or other?

## Launch Checklist
- [ ] Domain setup with Cloudflare
- [ ] Production D1 database
- [ ] Payment gateway configured (production keys)
- [ ] Resend domain verified
- [ ] Content migrated
- [ ] SSL configured
- [ ] Full payment flow tested
