# Architecture

## Stack

- **Frontend:** React Router v7 (SSR mode) on Cloudflare Workers
- **CMS:** PayloadCMS (headless, REST API) on Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite)
- **Images:** Cloudflare R2 storage + Cloudflare Image Resizing (reused from v1)
- **Monorepo:** pnpm workspaces — `apps/cms`, `apps/fe`, `packages/shared`, `scripts`

## Collections (PayloadCMS)

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| **Trails** | Trail content + metadata | title, slug, difficulty, access, area, highlights, content (markdown textarea), coverImage, photos, gpxFile, gps, mapLink, hiking/driving stats, status |
| **Users** | Auth + membership | email, role (admin/contributor/lifetime/yearly), phone, membershipExpiresAt, trailPurchases, paymentSource |
| **Media** | Image uploads | file, alt text |
| **GpxFiles** | GPX track uploads | file (GPX format only) |
| **Areas** | Lookup table | name (unique) |
| **Highlights** | Lookup table / tags | name (unique) |

Planned but not yet created: **Payments**, **Events**, **Blog**

## Routes (Frontend)

| Route | Page | Status |
|-------|------|--------|
| `/` | Redirects to `/trails` | ✅ |
| `/trails` | Trail listing with filters | ✅ |
| `/trails/:slug` | Trail detail | ✅ |
| `/login` | Login form | ✅ |
| `/logout` | Clears auth cookie | ✅ |
| `/design` | Design system showcase | 🟡 Stub |
| `/pricing` | Pricing tiers | 🔴 |
| `/checkout` | Payment flow | 🔴 |
| `/dashboard` | User dashboard | 🔴 |
| `/events` | Events listing | 🔴 |
| `/events/:slug` | Event detail | 🔴 |
| `/blog` | Blog listing | 🔴 |
| `/blog/:slug` | Blog post | 🔴 |

## Auth Flow

1. User submits email/password to `/login` action
2. FE server calls CMS `POST /api/users/login`
3. CMS returns JWT
4. FE sets `payload-token` as HTTP-only cookie (7 day expiry, scoped to `.blrhikes.com` in prod)
5. Subsequent FE server requests forward cookie to CMS
6. CMS field-level access checks user role + membership expiry

## Data Flow

```
GitHub Issues (shreshthmohan/blrhikes-data)
  → scripts/migrate.ts (ETL: parse frontmatter, rewrite image URLs, upload)
  → PayloadCMS REST API (storage in D1)
  → apps/fe loader functions (fetch from CMS, normalize)
  → React components (render)
```

## Image Pipeline (from v1)

```
GitHub user-attachment URL
  → Rewrite to: blrhikes.com/cdn-cgi/image/width=800,quality=80,format=jpeg/https://images.blrhikes.com/{uuid}
  → R2 bucket serves the original
  → Cloudflare Image Resizing handles transforms on the edge
```

Image URL rewriting happens at migration time (not render time like v1).

## Constants (packages/shared)

- 5 difficulty levels (easy → hard)
- 5 access types (open → unmonitored)
- 22 highlight tags (lake, cave, waterfall, temple, camping, etc.)
- 13 area regions around Bangalore
- 4 user roles (admin, contributor, lifetime, yearly)
- 3 hiking duration filter brackets
