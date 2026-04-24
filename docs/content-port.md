# Content Port — Runbook

Operational guide for getting trail content from GitHub Issues into the CMS,
and re-running the port as the upstream issues evolve.

**Background**: trail content for v1 of blrhikes.com lives in the
`shreshthmohan/blrhikes-data` repo as GitHub Issues:

- Issues labeled `trail` + `status:live` are the ~32 active trails.
- YAML frontmatter in the issue body holds metadata (altName, GPS, difficulty,
  area, mapLink, etc.); markdown after the frontmatter is the trail content.
- H2 headings (`## …`) inside the issue body split the content into **public
  sections**.
- Separate issue comments with `section:` + `status: live` frontmatter become
  **members-only sections**. That's the gating axis, period.

The migration pipeline is three scripts, run in order:
`seed` (trails + legacy content) → `seed:gpx` (GPX files) →
`seed:sections` (structured sections + members-only gating).

---

## 0. Fresh seed (when the CMS is wiped clean)

Order matters. Each step depends on the previous one.

### 0a. Start the CMS and create the first admin

```bash
pnpm dev:cms
```

Open `http://localhost:3000/admin`. Since the DB is empty, Payload asks you to
create the first user. Do it — email + password for *admin login only*, not for
script auth.

### 0b. Mint an API key for that admin

Still in the admin UI:

1. `/admin/collections/users` → click your user.
2. Scroll to **API Key** → toggle **Enable API Key** on.
3. Click the regenerate button, copy the key.
4. Save the user.

### 0c. Put the key + GitHub token in `scripts/.env`

```bash
# scripts/.env
CMS_URL=http://localhost:3000
CMS_API_KEY=<paste the key from 0b>
GITHUB_TOKEN=<your github PAT — raises rate limit 60→5000/hr>
```

All three seed scripts (`seed`, `seed:gpx`, `seed:sections`) read the same
env file and use the same API key — no email/password anywhere.

### 0d. Seed trails from GitHub issues

```bash
pnpm --filter scripts seed
```

This does the full GitHub fetch on first run (writes `scripts/.cache/github-data.json`),
then creates one trail per `trail + status:live` issue. `content` gets populated
with the legacy flat markdown — which is fine, because §3 will re-port it into
the new structured `sections` field.

Re-running is a no-op on existing trails unless you pass `--force` (updates) or
`--refresh` (re-pulls from GitHub first).

### 0e. Upload GPX files

```bash
# From repo root — reads GPX files from the legacy blrhikes repo
pnpm --filter scripts seed:gpx
```

This uploads each `.gpx` in `blrhikes/public/gpx/` into the CMS `gpx-files`
collection and links them to trails by slug. Needed before `seed:sections`
can resolve GPX attachments.

### 0f. Port sections from issue bodies + comments

See §3b for details. Short form:

```bash
pnpm --filter scripts seed:sections            # dry run
pnpm --filter scripts seed:sections -- --commit
```

At this point the CMS has: trails (with legacy `content` + new `sections`),
gpx-files, and all cross-references resolved. Open the admin UI, open a
trail, scroll to Sections — you should see the H2-split public sections and
members-only sections from live comments.

### 0g. (Optional) Curate galleries by hand

The port script deliberately doesn't populate the `gallery` array — inline
images stay inline. If you want the view-transitions gallery to have photos,
add them manually per trail in the admin UI.

---

## 1. Local dev — verify the schema change

The d1-sqlite adapter auto-pushes schema on dev server start (NODE_ENV ≠ production), so no migration file is needed yet.

```bash
# From repo root
pnpm dev:cms
```

Open `http://localhost:3000/admin/collections/trails` → pick any trail → expect to see:

- A new **Sections** array field below the old `Content` textarea (marked "Legacy")
- The old `Photos` block renamed to **Gallery**, with a new `caption` field per row
- Section rows have: `heading`, `slug` (auto-populated from heading on save), `visibility` (public / members), `published`, `body` (markdown), `attachments` (polymorphic — accepts GPX or Media)

**Smoke test for the hooks**:

1. Create a new trail; add two sections with the same heading ("Notes" and "Notes"). Save. Expect slugs `notes` and `notes-2`.
2. Flip one section's `visibility` to "Members only". Save. Log out (or open an incognito tab). Hit `/api/trails/<id>` — the members-only row should have `body: null`, `attachments: []`. The public row should be intact.
3. Uncheck `published` on a row. As non-editor, hit the API — the row should not appear at all.

If any of those misbehave, the `afterRead` / `beforeValidate` hooks need a look (they live at the bottom of `apps/cms/src/collections/Trails.ts`).

## 2. Local dev — verify the web app

```bash
# Separate terminal, CMS still running
pnpm dev:web
```

Visit `http://localhost:5173/trails/<some-slug>`.

Expect:

- Legacy trails (with `content` set but no `sections`) render via the old fallback path — no regressions.
- Trails you added sections to render as sections with a TOC above them.
- Members-only sections show a lock stub with a "Log in / Become a member" CTA when you're signed out.
- Gallery (if populated) — clicking a thumbnail navigates to `/trails/<slug>/photo/<mediaId>`, the image morphs via View Transitions (Chrome/Safari/Edge; Firefox just nav without animation), close button goes back.
- Keyboard nav between photos isn't wired yet — only prev/next buttons.

## 3. Port the existing GitHub Issues data into sections

**Prereq**: trails + gpx-files need to already be in the CMS. Run `migrate.ts` and `migrate-gpx.ts` first if fresh.

### 3a. Refresh the GitHub cache (do this whenever issues change upstream)

```bash
# Required env:
#   GITHUB_TOKEN=<personal access token>   # raises rate limit 60→5000/hr

# Refreshes cache only — does not touch the CMS, exits after writing the file.
pnpm --filter scripts seed:sections -- --refresh
```

This re-fetches every `trail + status:live` issue and its comments from
`shreshthmohan/blrhikes-data`, writes to `scripts/.cache/github-data.json`, and
exits. Run this whenever the upstream issue content has changed.

If the cache file doesn't exist when you run a port (3b below), the script
auto-refreshes on first run. After that, cache hits are used until you pass
`--refresh` again.

> `--refresh` never ports. To refresh *and* port, run the command twice —
> once with `--refresh`, then again with `--commit` (or no flag for dry-run).
> This keeps the GitHub pull and the CMS writes cleanly separated.

### 3b. Port cached data into the CMS

```bash
# Required env in scripts/.env — same pattern as migrate-gpx.ts uses:
#   CMS_URL=http://localhost:3000
#   CMS_API_KEY=<generated on a user doc in /admin/collections/users>
#
# To mint the key: /admin → Users → your admin user → enable "Generate API Key"
# → save → copy the key into scripts/.env.

# Dry run (default). Prints per-trail diff: +create ~update =keep -delete
pnpm --filter scripts seed:sections

# Single-trail mode for iteration
pnpm --filter scripts seed:sections -- --trail skandagiri

# When the dry-run diff looks right, commit
pnpm --filter scripts seed:sections -- --commit
```

What the script does:

- Reads the cached GitHub issue bodies + comments from `scripts/.cache/github-data.json`.
- Splits each issue body on `## ` H2s → public sections (with `sourceRef: body-h2-N` or `body-preamble`).
- Each `status: live` comment with a `section:` frontmatter → members-only section (`sourceRef: comment-<id>`).
- Rewrites GitHub image URLs → CDN URLs in-place.
- Pulls `.gpx` links out of section bodies and attaches them via `gpx-files` lookup.
- Leaves inline images in the section body (rendered by the Markdown component). Does **not** auto-populate the gallery — that's a manual curation step (see §6 of plan).
- Upserts keyed on `sourceRef`, so re-runs are idempotent even if editors rename headings. Editor-authored sections (no sourceRef) are never touched.

## 4. QA on staging

For each of these, pick 2-3 trails and check:

- [ ] Legacy `content` still renders on trails that have it but no sections.
- [ ] Ported trails render with TOC + sections, images inline.
- [ ] Members-only sections show lock stub when logged out / not-entitled.
- [ ] Logging in as a `lifetime` member unlocks members-only bodies + attachments.
- [ ] GPX attachments download.
- [ ] Gallery view-transitions animate on Chrome/Safari. Close + prev/next work.
- [ ] Eyeball `/api/trails/<slug>` response size — a sections-heavy trail shouldn't balloon past a few hundred KB. If it does, lower `depth` in `fetchTrailBySlug` (`apps/web/app/lib/api.server.ts`).

## 5. Schema migration on deploy

Schema is auto-migrated by CF Workers Builds — the CMS `build` script runs
`payload migrate --disable-confirm` against the remote D1 (test or live
depending on the `CLOUDFLARE_ENV` build variable) before the Next build.
If the migration fails, the deploy fails. Schema and code always land
together.

No manual `deploy:database` is needed for regular pushes. See
`docs/migrations.md` for the detailed workflow on writing and testing a
new migration. See `docs/deploy.md` for the CF configuration.

## 6. Port data against prod

Once the live worker is up and the live D1 has the current schema,
run the port from your local machine:

```bash
CMS_URL=https://cms.blrhikes.in \
CMS_API_KEY=<live-admin-api-key> \
  pnpm --filter scripts seed      # trails
CMS_URL=https://cms.blrhikes.in \
CMS_API_KEY=<live-admin-api-key> \
  pnpm --filter scripts seed:gpx
CMS_URL=https://cms.blrhikes.in \
CMS_API_KEY=<live-admin-api-key> \
  pnpm --filter scripts seed:sections -- --commit
```

The API key is minted per-environment — mint a fresh one on the live
admin user and keep it out of version control. Check a handful of
prod trails after.

## 7. Cleanup (follow-up release — legacy `content` / `photos` removal)

The trail collection still carries the legacy `content` textarea and `photos`
array from before sections/gallery shipped. Once sections have been soaking
in prod for a cycle and no rollback is needed:

- Remove `content` and `photos` fields from `apps/cms/src/collections/Trails.ts`
  (and the fallback path in `apps/web/app/routes/trail-detail.tsx` that
  renders `content` when `sections` is empty).
- Run `pnpm generate:types:payload`.
- Run `pnpm migrate:create` to generate a drop-columns migration.
- Push — CF build applies it on deploy.

---

## Troubleshooting

### Seed scripts getting 403 on create (`Failed to create area …`, `Failed to create trail …`)

403 at the create layer = `req.user` is null = the API key isn't resolving on the server. Being an admin user doesn't help here; auth has to succeed *before* the role check runs.

**Step 1 — verify the key works against a trivial endpoint:**

```bash
# From repo root, with CMS_API_KEY exported or readable from .env
curl -s -w "\nHTTP %{http_code}\n" \
  -H "Authorization: users API-Key $CMS_API_KEY" \
  http://localhost:3000/api/users/me
```

Expected: `HTTP 200` and a JSON body with a non-null `"user": { "id": …, "role": "admin", … }`.

- `HTTP 200` + `"user": null` → the header reached the server but didn't match any user. Key is wrong, or the user doc doesn't have its per-doc API-key toggle saved.
- `HTTP 401 / 403` → header format mismatch or CSRF/cors blocking. Re-check the exact header is `Authorization: users API-Key <key>` (literal string `users API-Key` with a space).
- `curl: (7) Failed to connect` → CMS isn't running, `pnpm dev:cms` first.

**Step 2 — if `/api/users/me` returned null, re-mint the key:**

1. Open `/admin/collections/users` → click your admin user.
2. Find **API Key**. Toggle **Enable API Key** ON if it isn't.
3. Click regenerate, then **Save the user doc** (a common gotcha: regenerate without saving doesn't persist).
4. Copy the newly shown key into `.env` → `CMS_API_KEY=...`.
5. Re-run the curl above to confirm.

### Other

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Port script: "no trail found in CMS" | `migrate.ts` hasn't been run against this CMS | Run `pnpm --filter scripts seed` first |
| GitHub API 403 | Unauthenticated; rate limit hit | Set `GITHUB_TOKEN` in `.env` (raises limit 60 → 5000/hr) |
| Sections show raw `{ relationTo: 'gpx-files', value: ... }` in frontend | `api.server.ts` normalization not running | Check `normalizeTrail()` — the sections block should flatten the polymorphic upload |
| Members-only section body leaking to anonymous users | `afterRead` hook isn't firing on this API path | Test via `/api/graphql` too; the hook runs there as well — if it doesn't, file a payload bug |
| View Transitions not animating | Firefox (no support) or Safari < 18 | Behavior degrades to a plain nav — acceptable |
| Duplicate slugs after port | `dedupeSlugs` in both hook and script should prevent this; if you see it, one of the two didn't run | Check Payload logs; hook may have failed validation |

---

## Appendix: image URL rewriting

GitHub user-attachment URLs in the issue bodies get rewritten to the
Cloudflare CDN URL at port time (same pattern used in v1):

```
Input:  https://github.com/user-attachments/assets/{uuid}
Output: https://blrhikes.com/cdn-cgi/image/width=800,quality=80,format=jpeg/https://images.blrhikes.com/{uuid}
```

The images are already in R2 (proxied from v1) — no download or re-upload
needed, the URL rewrite is purely cosmetic to route through the CDN +
Image Resizing. Happens once at port time, not at render time.

## Appendix: how v1 handled this

The original Astro-based site processes markdown at build time via a
unified / rehype pipeline:

```
GitHub Issue API
  → gray-matter (strip frontmatter)
  → remarkParse → remarkGfm
  → remarkRehype → rehypeRaw → rehypeSlug
  → rehypeTransformImageUrls (CDN rewrite)
  → rehypeLightGallery (group consecutive images)
  → rehypeExternalLinks (target="_blank")
  → rehypeStringify → HTML
```

Key difference: v1 did this every build. v2 does it once at port time
and stores the result in the CMS.
