# Decisions

Key decisions made during planning and development. Reference for future context.

---

## Tech Stack

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Framework | React Router v7 (SSR) | Supports Cloudflare Workers, SSR for SEO + gated content |
| CMS | PayloadCMS | Headless, self-hosted, Cloudflare D1 adapter exists |
| Database | Cloudflare D1 (SQLite) | Free tier, edge-deployed, fits PayloadCMS adapter |
| Hosting | Cloudflare Workers | Edge compute, D1/R2 integration, existing domain setup |
| Images | Reuse v1's R2 + Cloudflare Image Resizing | No new infra needed, CDN URLs already work |
| Payments | Razorpay | Indian market, supports webhooks |
| Email | Resend | Simple API, good DX |

## Data & Content

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Data source | Migrate from GitHub Issues → PayloadCMS | GitHub Issues was fine for v1 but doesn't support gating, auth, or structured queries |
| Content field | `textarea` (markdown) now, Lexical later | Two-phase approach — fix URLs first, convert format later |
| Image URL handling | Rewrite at migration time, not render time | One-time cost vs. v1's every-build cost |
| Data normalization | Normalize during migration | Older trails missing fields get defaults |

## UX & Frontend

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Trail listing layout | Grid + List view toggle | User requested both |
| Mobile | Mobile-first responsive | Hikers browse on phones |
| Map view | Later (not Phase 1) | Nice to have, not blocking |
| Design system | Stone color palette + Tiempos font | Applied in Phase 1.5 |

## Filters & Search

| Decision | Choice | Notes |
|----------|--------|-------|
| Difficulty filter | ✅ Included | easy, moderate, moderate_hard, hard, very_hard |
| Highlights/tags filter | ✅ Included | 22 options |
| Access type filter | ✅ Included | 5 options |
| Area/region filter | ✅ Included | 13 regions |
| Hiking duration filter | ✅ Included | Short/medium/long brackets |
| Text search | ✅ Included | Trail title + area |
| Driving distance filter | 🔴 Deferred | Needs user location — UX design TBD |
| Driving time filter | 🔴 Deferred | Same location dependency |
| Rating filter | 🔴 Deferred | |
| Sort by difficulty | ✅ Included | |
| Sort by hiking time | ✅ Included | |
| Sort by distance | 🔴 Deferred | Needs location |
| Sort by rating | 🔴 Deferred | |

## Access Control

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Trail listing visibility | All trails visible, gated fields hidden | Users can browse everything, pay for location details |
| Gated fields | gps, mapLink, gpxFile | Location-identifying info only |
| Access enforcement | CMS field-level (PayloadCMS `access` functions) | Single source of truth, API-level gating |

## Answered Questions (from planning)

**Q: Keep GitHub Issues as source of truth?**
A: No. Migrate to PayloadCMS.

**Q: Normalize data or clean up GitHub issues first?**
A: Normalize during migration.

**Q: Framework — Remix, Astro, or other?**
A: React Router v7 (successor to Remix). Supports Cloudflare Workers SSR.

**Q: Hosting — Cloudflare, Vercel, Netlify?**
A: Cloudflare. Both CMS and FE on Workers/Pages.

**Q: Data fetching — static, SSR, hybrid?**
A: SSR. Content is paywalled, so can't be fully static. Server fetches from CMS with auth context.

**Q: Trail card fields?**
A: Title, area, cover image, difficulty, rating, length, elevation gain, driving time/distance, hiking duration, highlight tags.

**Q: Categories vs tags?**
A: Use highlights as tags (lake, waterfall, cave, etc.). Includes behavioral tags too (pet-friendly, beginner-friendly, wild-camping, swimming).
