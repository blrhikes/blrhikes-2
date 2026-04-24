# PR Review: `backend-v1` → `main`

**5 commits | 21 files changed | +890 / -27 lines**

## Summary

This PR adds three new CMS collections (Payments, Events, Blog), auto-calculates hiking stats from GPX uploads, integrates the HERE Routing API for driving distance/time, refactors `CMS_URL` handling in the frontend, switches the migration script from API key auth to email/password JWT, and overhauls the README.

## Commits

| Commit | Description |
|--------|-------------|
| `579cbde` | Auto-calculate driving distance/time + migrate script auth fix |
| `f46b569` | Parse hiking stats (distance, elevation gain, time) from GPX track |
| `b3c39b0` | Merge: bring backend-v1 up to date with main |
| `50d69e1` | Add Payments, Events, Blog collections + DB migrations |
| `4572523` | Use wrangler env for CMS_URL instead of hardcoded process.env |

## Files Changed

### New Files
- `apps/cms/src/collections/Blog.ts` — Blog collection with title, slug, author, content, related trails
- `apps/cms/src/collections/Events.ts` — Events collection with date, trail, meeting point, registration
- `apps/cms/src/collections/Payments.ts` — Payments collection for Razorpay integration
- `apps/cms/src/lib/gpx.ts` — GPX parsing: trailhead extraction, haversine, Naismith's rule stats
- `apps/cms/src/lib/driving.ts` — HERE Routing API integration for driving distance/time
- `apps/cms/src/migrations/20260312_000000.ts` — Migration: add `distance_from_bangalore` column to trails
- `apps/cms/src/migrations/20260312_000001.ts` — Migration: create payments, events, blog, blog_rels tables
- `apps/fe/.dev.vars.example` — Example env vars for FE

### Modified Files
- `apps/cms/src/collections/Trails.ts` — Added `distanceFromBangalore` field + `beforeChange` hook for GPX/GPS auto-calculation
- `apps/cms/src/payload.config.ts` — Register new collections
- `apps/cms/src/migrations/index.ts` — Register new migrations
- `apps/fe/app/lib/api.server.ts` — Refactor: pass `cmsUrl` as param instead of module-level `process.env`
- `apps/fe/app/routes/login.tsx` — Use `context.cmsUrl`
- `apps/fe/app/routes/logout.tsx` — Use `context.cmsUrl`
- `apps/fe/app/routes/trail-detail.tsx` — Pass `context.cmsUrl` to `fetchTrailBySlug`
- `apps/fe/app/routes/trails.tsx` — Pass `context.cmsUrl` to `fetchTrails`
- `packages/shared/src/types.ts` — Add `gpxFile` and `distanceFromBangalore` to Trail type
- `scripts/migrate.ts` — Switch from API key auth to email/password JWT login
- `scripts/.env.example` — Replace `CMS_API_KEY` with `CMS_EMAIL`/`CMS_PASSWORD`
- `README.md` — Comprehensive project documentation

## Issues Found

### High Priority

#### 1. Access control: Blog & Events expose drafts publicly
**Files:** `Blog.ts:148`, `Events.ts:239`

`read: () => true` means all documents — including drafts and cancelled events — are readable via the API by anyone. Should filter by status for unauthenticated users:
```ts
read: ({ req }) => {
  if (req.user) return true
  return { status: { equals: 'published' } }  // or 'open' for events
}
```

#### 2. Access control: Payments readable by any authenticated user
**File:** `Payments.ts:346`

`read: ({ req }) => !!req.user` lets any logged-in user read ALL payment records. Should scope to own records or admin:
```ts
read: ({ req }) => {
  if (req.user?.role === 'admin') return true
  return { user: { equals: req.user?.id } }
}
```

#### 3. Duplicate & inconsistent `BANGALORE_CENTER` constants
**Files:** `gpx.ts:2`, `driving.ts:8`

Defined in two places with different values:
- `gpx.ts`: `{ lat: 12.9763, lng: 77.5929 }` (Cubbon Park)
- `driving.ts`: `'12.9716,77.5946'` (different coordinates)

Should be a single shared constant. The difference is ~600m which affects distance calculations.

### Medium Priority

#### 4. `process.env` usage in CMS hooks won't work on Cloudflare Workers
**File:** `Trails.ts:332`

The `beforeChange` hook uses `process.env.PAYLOAD_SERVER_URL`. This works in Node/Next.js but will break if the CMS ever runs on Workers. Same concern for `process.env.HERE_API_KEY` in `driving.ts:50`. Fine for now since CMS is Next.js, but worth noting.

#### 5. GPX regex fragile with reversed attribute order
**File:** `gpx.ts:46`

The regex `/<wpt\s[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"/` assumes `lat` appears before `lon`. GPX files with `<wpt lon="77.5" lat="12.9">` would fail. Works with common GPS apps but fragile for edge cases.

### Low Priority

#### 6. Missing newlines at EOF
**Files:** `Trails.ts`, `driving.ts`

Both files missing trailing newlines (`\ No newline at end of file`).

#### 7. Migration `down()` uses DROP COLUMN
**File:** `20260312_000000.ts`

SQLite `DROP COLUMN` requires 3.35.0+. D1 supports this, but worth noting for portability.

#### 8. Migrate script formatting
**File:** `migrate.ts:1168`

`const FORCE = ...` line lost its blank line separator from the config block above it during the diff — reads awkwardly.

## What Looks Good

- Clean Payload collection definitions with logical field grouping and sidebar positioning
- Haversine formula and Naismith's rule implementations are mathematically correct
- `normalizeTrail` refactor to accept `cmsUrl` explicitly removes hidden `process.env` dependency
- Migration scripts have proper up/down with correct index creation
- HERE API integration has graceful null fallback when API key is missing
- `beforeChange` hook properly checks for GPX file changes before re-calculating

## Testing

### Automated Tests Added

Unit tests have been added for the pure utility functions introduced in this PR:

#### `tests/unit/gpx.unit.spec.ts`
- `haversineDistance` — zero distance, known distance (Bangalore→Mysore), symmetry
- `extractTrailheadFromGpx` — wpt extraction, trkpt fallback, wpt priority, empty/invalid GPX
- `parseGpsField` — valid parsing, whitespace, invalid inputs (single value, empty, non-numeric, three values)
- `distanceFromBangaloreCenter` — zero at center, known distance (Ramanagara), decimal rounding
- `parseGpxStats` — empty/single point, uphill track, descent-only, elevation rounding, length rounding, missing elevation data

#### `tests/unit/driving.unit.spec.ts`
- `getDrivingInfoFromBangalore` — missing API key returns null, successful response parsing, error handling, empty routes, duration formatting (hours only, minutes only, mixed), correct query params

### Running Tests

```bash
# All tests (unit + integration)
cd apps/cms && pnpm test:int

# Just unit tests
cd apps/cms && pnpm vitest run tests/unit/
```

### Manual Testing Checklist

- [ ] Create a Blog post as draft → verify it's NOT visible via unauthenticated API call
- [ ] Publish the blog post → verify it IS visible
- [ ] Create an Event with all fields → verify admin UI renders correctly
- [ ] Create a Payment record attempt via API → verify `create: () => false` blocks it
- [ ] Upload a GPX file to a trail → verify `length`, `elevationGain`, `hikingTime`, `hikingTimeWithRests` are auto-filled
- [ ] Edit a trail's `gps` field → verify `distanceFromBangalore` recalculates
- [ ] Set `HERE_API_KEY` and upload GPX → verify driving distance/time populate
- [ ] Unset `HERE_API_KEY` → verify no crash, just skips driving info
- [ ] Run migration on fresh D1 database → verify all tables created
- [ ] Run migration down → verify clean rollback
- [ ] Verify FE trails page loads with `context.cmsUrl` (not process.env)
- [ ] Verify FE login/logout still works after `context.cmsUrl` refactor
- [ ] Run `pnpm migrate` script with `CMS_EMAIL`/`CMS_PASSWORD` → verify JWT auth works

### Additional Tests Worth Adding (Future)

| Area | What to Test | Type |
|------|-------------|------|
| `Trails.beforeChange` hook | GPX upload triggers stat calculation, GPS change triggers distance recalc | Integration |
| Blog/Events access control | Draft visibility by role (anon vs authenticated) | Integration |
| Payments access control | User can only read own payments | Integration |
| `normalizeTrail` (FE) | Cover image URL prefixing, area/highlight flattening | Unit |
| `buildTrailsQuery` (FE) | Query string construction for all filter combinations | Unit |
| Migration rollback | Up then down leaves DB clean | Integration |

## Verdict

Fix **#1-3** (access control gaps + inconsistent coordinates) before merging. The rest are nice-to-haves. The core functionality — GPX parsing, driving API, new collections — is solid.
