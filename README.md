# BLR Hikes 2.0 🥾

A modern rebuild of [blrhikes.com](https://blrhikes.com) — the hiking guide platform for trails around Bangalore. Premium trail info, community features, events, content gating, and payments.

## Tech stack

| Layer      | Tech                                         |
|------------|----------------------------------------------|
| Frontend   | React Router v7 (SSR) + TailwindCSS v4       |
| CMS        | PayloadCMS v3 (headless, REST + GraphQL)     |
| Database   | Cloudflare D1 (SQLite)                       |
| Hosting    | Cloudflare Workers (OpenNext for the CMS)    |
| Images     | Cloudflare R2 + Cloudflare Image Resizing    |
| Email      | Resend (planned)                             |
| Payments   | Razorpay (planned)                           |

## Repo layout

```
blrhikes-2/
├── apps/
│   ├── cms/            # PayloadCMS app (Next.js 15 + Payload, served via Workers + OpenNext)
│   └── web/            # React Router v7 frontend (served directly via Workers)
├── packages/
│   └── shared/         # Shared TypeScript types, constants, format utilities
├── scripts/            # Data port scripts (GitHub Issues → CMS, GPX upload, sections port)
├── docs/               # Operational runbooks — deploy, migrations, content port
├── design/             # Design system HTML prototypes (6 theme variants)
└── .githooks/          # Pre-commit hook (schema-migration warner, cloudflare-type autogen)
```

## Prerequisites

- Node.js v22+
- pnpm v9+
- A Cloudflare account (for deploys)

## Quick start (local)

```bash
pnpm install

# Terminal 1 — CMS admin + API at http://localhost:3000
pnpm dev:cms

# Terminal 2 — Web app at http://localhost:5173
pnpm dev:web
```

First run: open `http://localhost:3000/admin` and create the first admin user. Subsequent seeding uses API keys — see [docs/content-port.md](./docs/content-port.md) §0 for the full bootstrap.

Activate the pre-commit hook (one-time):

```bash
git config core.hooksPath .githooks
```

## Common scripts

### Root (across workspaces)

| Script                  | What it does |
|-------------------------|--------------|
| `pnpm dev:cms`          | Start CMS dev server |
| `pnpm dev:web`          | Start web dev server |
| `pnpm build:cms`        | Build CMS for production (includes `migrate:prod`) |
| `pnpm build:web`        | Build web for production |
| `pnpm migrate`          | Apply un-applied migrations to local D1 |
| `pnpm migrate:create`   | Generate a new migration from schema diff |
| `pnpm seed`             | Seed trails from GitHub Issues cache |
| `pnpm seed:gpx`         | Upload GPX files to CMS |

### CMS-specific (`apps/cms/package.json`)

| Script                          | Notes |
|---------------------------------|-------|
| `pnpm --filter cms migrate:prod`| Non-interactive migrate. Used by `build`. Targets whatever D1 `CLOUDFLARE_ENV` resolves to |
| `pnpm --filter cms build:cf`    | Build-only (no migrate). Escape hatch; normal flow should not need this |
| `pnpm --filter cms deploy:database` | Manual out-of-band remote migrate + `PRAGMA optimize` |
| `pnpm --filter cms generate:types` | Regenerate Payload + Cloudflare TS types |

### Scripts package (`scripts/`)

| Script                                    | Notes |
|-------------------------------------------|-------|
| `pnpm --filter scripts seed:sections`     | Port issue bodies + comments → structured sections (dry-run by default) |
| `pnpm --filter scripts seed:sections -- --commit`  | Actually write |
| `pnpm --filter scripts seed:sections -- --refresh` | Refresh GitHub issue cache (no CMS writes) |

## Architecture

### Apps

- **`apps/cms`** — PayloadCMS on Next.js, deployed via OpenNext to Cloudflare Workers. Exposes REST + GraphQL APIs and the admin UI.
- **`apps/web`** — React Router v7 SSR app on Cloudflare Workers. Fetches from the CMS server-side (auth cookie flows server→CMS) and renders.

### Data flow (day-to-day traffic)

```
Browser
  → Web worker (apps/web) — React Router loader
     → fetch() to CMS worker using payload-token cookie
        → CMS worker (apps/cms) — Payload access control runs
           → D1 binding
  ← JSON (with gated fields stripped based on role)
  ← SSR HTML
```

### Data flow (content port — one-time / on-update)

```
GitHub Issues (shreshthmohan/blrhikes-data)
  → scripts/migrate.ts           (trails + legacy markdown content)
  → scripts/migrate-gpx.ts       (GPX files)
  → scripts/migrate-sections.ts  (structured sections + members-only gating)
  → CMS REST API (using users API-Key header)
```

Runbook: [docs/content-port.md](./docs/content-port.md).

### Image pipeline (reused from v1)

```
GitHub user-attachment URL
  → Rewritten at port time to: blrhikes.com/cdn-cgi/image/width=800,quality=80,format=jpeg/https://images.blrhikes.com/{uuid}
  → R2 bucket serves the original
  → Cloudflare Image Resizing handles transforms at the edge
```

No re-upload needed — images are already proxied through R2 from v1.

## Data model

### Collections

| Collection     | Purpose                    | Key fields |
|----------------|----------------------------|------------|
| **Trails**     | Trail content + metadata   | `title`, `altName`, `slug` (id-prefixed), `area`, `difficulty`, `access`, `highlights`, `rating`, `coverImage`, `gallery`, `gpxFile`, gated `gps` + `mapLink`, auto-calculated hiking/driving stats, `sections[]` (structured content), `status` |
| **Users**      | Auth + membership          | `email`, `role`, `phone`, `firstName`, `membershipExpiresAt`, `trailPurchases`, `paymentSource`, API key |
| **Media**      | Image uploads              | `file`, `alt` — stored in R2 |
| **GpxFiles**   | GPX track uploads          | `file` — stored in R2 |
| **Areas**      | Trail regions              | `name` (unique) — ~13 Bangalore regions |
| **Highlights** | Trail tags                 | `name` (unique) — ~22 tags (lake, cave, waterfall, etc.) |

Deleted from the Phase A scope to slim the schema surface: `Payments`, `Events`, `Blog` — will come back as needed.

### Trail URL scheme

Trails are addressable at both `/trails/<id>` and `/trails/<id>-<altName-slug>`. The loader parses the leading `\d+` out of the URL segment, looks the trail up by id, and redirects non-canonical URLs (bare id, stale slug) to `<id>-<altName-slug>`. A Payload `beforeValidate` + `afterChange` hook pair keeps every trail's slug canonical after saves.

### Sections (trail content)

`trail.content` (single markdown blob) is the legacy shape; `trail.sections[]` is the current shape — an ordered array with each row carrying:

- `heading` + auto-derived `slug` (for TOC anchoring; deduped per-trail)
- `visibility: 'public' | 'members'` — drives server-side gating
- `published: boolean` — editors can stash work-in-progress
- `body` (markdown)
- `attachments[]` (polymorphic upload → `gpx-files` or `media`)
- `sourceRef` — stable id stamped by the port script, used as the upsert key

The frontend prefers `sections[]` when non-empty and falls back to `content` otherwise.

### Gallery

Single per-trail `gallery[]` array of `{ image (Media), caption }`. Rendered on the trail detail page as a grid; clicking a thumbnail navigates to a nested `trails/:slug/photo/:photoId` route and morphs the image via the View Transitions API (works in Chrome/Safari/Edge; Firefox degrades to a plain nav).

## Auth & gating

### User roles

| Role            | Gated field access | Admin UI          | Expiry                                   |
|-----------------|--------------------|-------------------|------------------------------------------|
| `admin`         | Yes                | Full              | Never                                    |
| `contributor`   | Yes                | Edit trails       | Never                                    |
| `lifetime`      | Yes                | No                | Never                                    |
| `yearly`        | Yes                | No                | 12 months from payment; immediate cutoff |

First user created gets `admin` automatically (beforeChange hook on `users`). Other users default to `lifetime` (set by Razorpay webhook on payment, once that's wired).

### Gated fields on trails (require auth)

- `gps` — trailhead coordinates
- `mapLink` — GaiaGPS or similar
- `gpxFile` — GPX track file

Access logic: admin, contributor, lifetime, non-expired yearly, OR the trail id is in `user.trailPurchases[]`. Enforced at the CMS field level — the fields are stripped from API responses for unentitled users.

### Members-only sections

A trail section with `visibility: 'members'` is gated at the row level via an `afterRead` hook on the `trails` collection (Payload's field-access runs per-field, not per-row). For non-entitled viewers, the hook wipes both `body` and `attachments`, leaves `heading` and `slug` intact so the TOC still renders a locked stub with an upsell CTA.

### Auth flow

1. User POSTs email + password to `/login` action in the web worker.
2. Web worker calls CMS `POST /api/users/login`.
3. CMS returns a JWT; web worker sets it as a `payload-token` HTTP-only cookie (domain `.blrhikes.in` in prod, scoped to `localhost` in dev).
4. Subsequent web-worker SSR requests forward the cookie to the CMS.
5. CMS field-level access functions check role + membership expiry.

### Individual trail purchases

Users can buy access to a single trail without a membership. Stored as `trailPurchases[]` on the User doc. Gated-field access logic checks: valid membership OR trail id in that array.

### Razorpay webhook (planned)

- Endpoint: `POST /api/rzp-webhook` on the CMS.
- Signature verification via HMAC-SHA256 with `RZP_WEBHOOK_SECRET`.
- Branches by payment "variant":
  - **Membership** → create/update user, set role + `membershipExpiresAt`, send onboarding email.
  - **Trail purchase** (`reason` starts with `trail-`) → append trail id to `user.trailPurchases[]`, send trail email.
  - **Event purchase** → deferred until Events collection exists.

## Design tenets / decisions

- **SSR, not static.** Content is gated. Static generation would leak members-only fields into the public bundle. Every page is SSR'd with an auth context.
- **Normalize at port time, not at render time.** v1 did URL rewriting / lightgallery grouping on every build. v2 does them once in the port script. Faster, lower edge CPU.
- **Payload's field access as the single source of truth for gating.** Frontend doesn't check — it just displays whatever the API returned. Makes the surface area small.
- **id-prefixed trail slugs.** Both short links (`/trails/42`) and descriptive links (`/trails/42-glasswater-lake`) work. Loader redirects to the descriptive one. Editor renames don't break bookmarks as long as the id prefix stays stable.
- **CLI-generated migrations only.** Hand-written ones bypass Drizzle's SQLite / D1 quirk handling and break on fresh DBs. See `docs/migrations.md`. Pre-commit hook warns when schema files change without a new migration.
- **Washi pattern on wrangler.jsonc.** No top-level bindings; every deploy must pick an env via `--env=<name>`. Forgetting `CLOUDFLARE_ENV` fails loudly instead of silently hitting a default.

## Routes (frontend)

| Route                              | Status       | Description |
|------------------------------------|--------------|-------------|
| `/`                                | ✅           | Redirects to `/trails` |
| `/trails`                          | ✅           | Listing with filters (difficulty, highlights, access, area, duration, search) |
| `/trails/:slug`                    | ✅           | Trail detail — sections, TOC, gated stubs, gallery |
| `/trails/:slug/photo/:photoId`     | ✅           | Nested gallery detail with View Transitions |
| `/login`                           | ✅           | Login form |
| `/logout`                          | ✅           | Clears auth cookie |
| `/design`                          | 🟡 stub       | Design system showcase |
| `/pricing`                         | 🔴 planned   | Membership tiers |
| `/dashboard`                       | 🔴 planned   | User dashboard |
| `/events`, `/events/:slug`         | 🔴 planned   | Events |

## Phase status

| Phase                       | Status         |
|-----------------------------|----------------|
| 1. Foundation (CMS + FE scaffold, trails CRUD, migration scripts) | ✅ done |
| 1.5 Design system (Stone palette, Tiempos, light mode)            | 🟡 partial |
| 2. Auth & access (login, field gating, section gating)            | ✅ done |
| 3. Sections + gallery + content port                              | ✅ done |
| 4. Cloudflare deploy (test + live envs, auto-migrate on push)     | 🟡 in progress |
| 5. Payments (Razorpay webhook, membership/purchase flows)         | 🔴 not started |
| 6. Events & community                                             | 🔴 not started |
| 7. Launch prep (prod content port, SEO, monitoring)               | 🔴 not started |

## Runbooks

Three operational docs in `docs/`:

- **[docs/deploy.md](./docs/deploy.md)** — Cloudflare Workers setup: creating D1 + R2 via wrangler CLI, wiring up GitHub integration, custom domains, env variables.
- **[docs/migrations.md](./docs/migrations.md)** — How Payload/D1 migrations work in this repo, day-to-day commands, the destructive baseline-reset procedure, gotchas.
- **[docs/content-port.md](./docs/content-port.md)** — GitHub Issues → CMS port: fresh seed, re-running the port, verifying members-only gating, appendix on the v1 pipeline.

## License

Private repo. Not open source.
