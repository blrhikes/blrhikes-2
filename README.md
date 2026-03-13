# BLR Hikes 2.0 🥾

A modern rebuild of [blrhikes.com](https://blrhikes.com) — the hiking guide platform for trails around Bangalore. Premium trail info, community features, events, content gating, and payments.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React Router v7 (SSR) + TailwindCSS v4 |
| CMS | PayloadCMS v3 (headless, REST API) |
| Database | Cloudflare D1 (SQLite) |
| Hosting | Cloudflare Workers (via OpenNextJS) |
| Images | Cloudflare R2 + Image Resizing |
| Email | Resend (planned) |
| Payments | Razorpay (planned) |

## Project Structure

```
blrhikes-2/
├── apps/
│   ├── cms/            # PayloadCMS app (Next.js 15 + Payload)
│   └── fe/             # React Router v7 frontend (Cloudflare Workers)
├── packages/
│   └── shared/         # Shared TypeScript types, constants & enums
├── scripts/            # Migration & seeding (GitHub Issues → CMS, GPX upload)
├── docs/               # Architecture, decisions, trail design, user roles
└── design/             # Design system HTML prototypes (6 theme variants)
```

## Prerequisites

- Node.js v22+
- pnpm v9+

## Quick Start

```bash
# Install dependencies
pnpm install

# Start CMS (PayloadCMS admin + API)
pnpm dev:cms        # → http://localhost:3000

# Start frontend
pnpm dev:fe         # → http://localhost:5173
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev:cms` | Start CMS dev server |
| `pnpm dev:fe` | Start frontend dev server |
| `pnpm build:cms` | Build CMS for production |
| `pnpm build:fe` | Build frontend for production |
| `pnpm migrate` | Run Payload database migrations |
| `pnpm seed` | Seed trails from GitHub Issues |
| `pnpm seed:gpx` | Upload & seed GPX files |

## Data Models

- **Trails** — Core hiking data (difficulty, area, highlights, GPX tracks, photos, rich content)
- **Users** — Auth & membership tiers (admin, contributor, lifetime, yearly)
- **Media** — Image uploads (stored in R2)
- **GpxFiles** — GPX track uploads
- **Areas** — 13 regions around Bangalore (Ramanagara, Kanakapura, Kolar, etc.)
- **Highlights** — 22 trail tags (lake, cave, waterfall, forest, temple, scramble, camping, etc.)

## Frontend Routes

| Route | Status | Description |
|-------|--------|-------------|
| `/trails` | ✅ | Trail listing with filters |
| `/trails/:slug` | ✅ | Trail detail page |
| `/login` | ✅ | Login form |
| `/logout` | ✅ | Auth cleanup |
| `/design` | 🟡 | Design system showcase |
| `/pricing` | 🔴 | Membership tiers |
| `/dashboard` | 🔴 | User dashboard |
| `/events` | 🔴 | Events listing |

## Architecture Highlights

- **Monorepo** — Apps share types/constants via `@blrhikes/shared` package
- **Image pipeline** — R2 bucket → Cloudflare Image Resizing (CDN-level transforms)
- **Auth flow** — Email/password → Payload JWT → HTTP-only cookie (7-day expiry)
- **Data migration** — GitHub Issues → migration script → CMS REST API
- **Deploy target** — Both CMS and FE deploy to Cloudflare Workers

## Phase Status

| Phase | Status | Summary |
|-------|--------|---------|
| **1. Foundation** | 🟡 Almost done | CMS + FE scaffolded, trails CRUD, migration script, basic UI |
| **1.5 Polish** | 🟡 Partial | Stone + Tiempos design applied (light mode) |
| **2. Auth & Access** | 🟡 Started | Login/logout, field-level gating on trails |
| **3. Payments** | 🔴 Not started | Razorpay webhook design doc exists |
| **4. Events & Community** | 🔴 Not started | — |
| **5. Launch Prep** | 🔴 Not started | Content migration, SEO, testing, production deploy |

## Documentation

Detailed docs live in the [`docs/`](./docs/) directory:

- [Architecture](./docs/architecture.md) — Data models, collections, routes, infra decisions
- [Trail Design](./docs/trail-design.md) — Trail schema, sections, GPX handling, computed fields
- [User Roles](./docs/user-roles.md) — Roles, access control, Razorpay webhook flow, gated fields
- [Content Migration](./docs/content-migration.md) — Strategy for GitHub Issues → CMS migration
- [Decisions](./docs/decisions.md) — Key decisions made and rationale
