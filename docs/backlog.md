# Backlog

Task tracker for BLR Hikes v2. Checkboxes = done/not done. Each phase has its own section.

---

## Phase 1: Foundation

- [x] Project setup — pnpm monorepo with `apps/cms`, `apps/fe`, `packages/shared`
- [x] PayloadCMS with collections — Trails, Users, Media, Areas, Highlights, GpxFiles
- [x] Homepage (redirects to /trails for now)
- [x] Trail listing page with filters (difficulty, highlights, access, area, duration, search)
- [x] Trail detail page
- [x] Migration script (`scripts/migrate.ts`) — GitHub Issues → CMS via REST API
- [x] GPX migration script (`scripts/migrate-gpx.ts`)
- [x] Shared types and constants (`packages/shared`)
- [ ] Run migration against live/deployed CMS
- [ ] Deploy CMS to Cloudflare Workers (D1 database ID, R2 bucket, custom domains)
- [ ] Deploy FE to Cloudflare Workers
- [ ] Component showcase / design system page (route exists at `/design`, needs buildout)

## Phase 1.5: Polish & Dark Mode

- [x] Stone + Tiempos design applied to frontend (light mode)
- [ ] Dark mode support (`prefers-color-scheme` + manual toggle)
- [ ] Responsive polish pass (mobile-first, test across devices)
- [ ] Loading states and skeleton screens
- [ ] Error states (404, API failures)

## Phase 2: Auth & Access Control

- [x] Login page + action (JWT from PayloadCMS, sets `payload-token` cookie)
- [x] Logout page + action (clears cookie)
- [x] Field-level access control on Trails (gated: `gps`, `mapLink`, `gpxFile`)
- [x] Role-based access logic (admin, contributor, lifetime, yearly, trail purchases)
- [x] Users collection with roles, membership expiry, trail purchases
- [ ] Signup flow (or is registration payment-only? → see open questions)
- [ ] User dashboard (show membership status, purchased trails, profile)
- [ ] Password reset flow
- [ ] Session handling edge cases (expired yearly membership, cookie expiry)
- [ ] Payments collection (log of Razorpay payments)
- [ ] Events collection
- [ ] Blog collection

## Phase 3: Payments

- [ ] Razorpay integration — custom endpoint in CMS (`POST /api/rzp-webhook`)
- [ ] Webhook signature verification (HMAC-SHA256)
- [ ] Payment → user role update flow (lifetime, yearly, trail purchase)
- [ ] Pricing page on frontend
- [ ] Checkout flow (Razorpay button/redirect)
- [ ] Confirmation emails via Resend
- [ ] Payment logging to Payments collection
- [ ] Individual trail purchase flow

## Phase 4: Events & Community

- [ ] Events collection in CMS
- [ ] Events listing page
- [ ] Event detail page + registration
- [ ] Community page (gated, WhatsApp group access)
- [ ] Blog collection + listing/detail pages

## Phase 5: Launch Prep

- [ ] Full content migration (all 30+ trails with clean data)
- [ ] GPX file upload + map integration on trail pages
- [ ] SEO — meta tags, Open Graph, sitemap, structured data
- [ ] Domain setup (blrhikes.com → Cloudflare)
- [ ] Production D1 database provisioned
- [ ] Production Razorpay keys
- [ ] Resend domain verified
- [ ] SSL configured
- [ ] Full payment flow tested end-to-end
- [ ] Performance audit (Lighthouse, Core Web Vitals)

---

## Open Questions

### Unresolved

1. **Signup without payment?** Can users create an account without paying, or is registration only triggered by Razorpay payment? This affects whether we need a separate signup page. for now, they can't sign up without paying
2. **Yearly → lifetime upgrade:** What's the upgrade flow? Pay difference? Full price? does not matter right now. add this to the task list to decide in the future.
3. **Razorpay renewal:** Auto-renewal for yearly subscriptions or manual re-purchase? manual
4. **Discount codes:** Needed for launch? How do they work with Razorpay? future task
5. **Temporary event access codes:** Allow event attendees to access trails without login? How long does access last? actually let's keep this forever
6. **Map integration:** Leaflet vs Mapbox vs Google Maps? (Leaflet is free, Mapbox/Google have usage costs) what is this map integration? show things/trails on a map? if yes, we don't care about this right now.
7. **Analytics:** GA, Plausible, or Cloudflare Analytics? nothing right now
8. **Driving distance/time filters:** These need user location or a reference point. Deferred — needs UX design. the centrail static location will be provided as coordinates in the site globals in the ui.
9. **Rating/sorting by distance:** Deferred, same location dependency.
10. **Blog:** Is this needed for launch or post-launch? needed for launch, but is lower priority

### Resolved (see [decisions.md](./decisions.md))

- Payment gateway → Razorpay
- Data source → PayloadCMS (migrated from GitHub Issues)
- Hosting → Cloudflare Workers
- Framework → React Router v7
- Image CDN → Reuse v1's R2 + Cloudflare Image Resizing
- Content field → textarea (markdown) for now, Lexical later
- Trail listing layout → Grid + List view toggle
- Filters → difficulty, highlights, access, area, hiking duration, search
- Gating → all trails visible in listing, location-identifying info gated on detail page
