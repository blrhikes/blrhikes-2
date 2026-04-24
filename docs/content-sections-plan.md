# Plan: Sectioned Trail Content + Gallery + GitHub Port

Status: draft / planning
Owner: Shreshth
Goal: replace the single `content` textarea on `trails` with structured, gated sections that can hold markdown with inline images, downloadable files (mostly GPX), plus a per-trail photo gallery. Port existing GitHub Issues data into the new shape.

> **Scope call**: this plan is **phased**. Phase A ships sectioned markdown + a trail-level gallery + attachments, and keeps the existing `react-markdown` render stack. Phase B swaps markdown for Lexical rich text with inline gallery blocks. Phase A is the one we're actually building first; Phase B is scoped at the bottom so we don't accidentally design ourselves into a corner.

---

## 1. Current state (what we're replacing)

- `trails.content` is a single `textarea` of markdown (see `apps/cms/src/collections/Trails.ts:288-295`).
- Content on the prod site comes from `shreshthmohan/blrhikes-data` issues. The editorial convention (confirmed with Shreshth):
  - **H2 (`## ...`) inside the issue body = public section.**
  - **Separate issue comment with `section:` frontmatter = members-only section.** That's the gating axis, period.
  - The `status: live` frontmatter on a comment is an orthogonal publish/draft toggle — non-`live` comments are simply omitted from the render. It is **not** a public/members signal.
- `scripts/migrate.ts` already fetches issues + comments and flattens them into a single markdown blob via `parseLiveSections` (`scripts/migrate.ts:199-211`). We'll fork that path.
- `trails.photos` array (upload → media, `Trails.ts:131-141`) is the current rudimentary gallery: rendered at `apps/web/app/routes/trail-detail.tsx:283-303`, URL-absolutized at `apps/web/app/lib/api.server.ts:120-127`. We rename it to `gallery` and layer the view-transitions UI on top (§3). Pre-prod means no back-compat dance — just rename.

## 2. Target data model — Phase A

Replace `content: textarea` with a `sections` array field on `trails`. Each row = one section. Keep everything markdown for now — the render pipeline doesn't change, only the shape of the data.

```ts
{
  name: 'sections',
  type: 'array',
  labels: { singular: 'Section', plural: 'Sections' },
  fields: [
    { name: 'heading', type: 'text', required: true },        // e.g. "Getting there", "Route notes"
    {
      name: 'slug',
      type: 'text',
      required: true,
      admin: {
        description: 'Anchor id. Auto-derived from heading; editable. Must be unique within this trail.',
        readOnly: false,
      },
      // Auto-populated by a beforeValidate field hook (see §2.Slug derivation below).
    },
    {
      name: 'visibility',
      type: 'select',
      required: true,
      defaultValue: 'public',
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Members only', value: 'members' },
      ],
    },
    {
      name: 'published',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Uncheck to hide this section from the site (still visible to editors).',
      },
    },
    {
      name: 'body',
      type: 'textarea',                                       // Phase A: markdown. Phase B flips this to richText.
      admin: { description: 'Section body in markdown.' },
    },
    {
      name: 'attachments',
      type: 'array',
      fields: [
        {
          name: 'file',
          type: 'upload',
          relationTo: ['gpx-files', 'media'],                 // polymorphic so PDFs (permits, maps) fit too
          required: true,
        },
        { name: 'label', type: 'text' },                      // "Full loop GPX", "BBMP permit PDF", etc.
      ],
    },
    {
      // Stable id stamped by the port script. Hidden from the admin UI except in a debug panel.
      // Used as the upsert key when re-running the port so editing a heading doesn't break idempotency.
      name: 'sourceRef',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Migration source id. Do not edit.',
      },
    },
  ],
}
```

Also on the trail:

```ts
// Straight rename of the existing `photos` array (pre-prod, so no back-compat needed).
// New `caption` field added; existing `image` relationship stays.
{
  name: 'gallery',
  type: 'array',
  fields: [
    { name: 'image', type: 'upload', relationTo: 'media', required: true },
    { name: 'caption', type: 'text' },
  ],
},
```

Web-side call sites to update at the same time:
- `apps/web/app/lib/api.server.ts:120-127` — rename `photos` → `gallery` in the absolutize block.
- `apps/web/app/routes/trail-detail.tsx:283-303` — replace the current grid with the view-transitions gallery component (§3).

### Gating

Payload field access runs on the field as a whole, not per-row. Row-level gating goes in a collection `afterRead` hook:

- For each row in `sections`:
  - If `published === false` and the requester isn't an editor (role admin/contributor), drop the row entirely.
  - If `visibility === 'members'` and the requester isn't entitled (reuse `canReadGatedField`'s logic extracted into a pure function), **wipe both `body` AND `attachments`** — not just the body. Leave `heading` and `slug` so the TOC still works, plus a flag like `locked: true` that the frontend uses to render an upsell stub.
- Editors (admin/contributor) always see everything.

**Verify during implementation**: that this hook fires on REST, GraphQL, and local API paths — otherwise we're leaking via GraphQL. Payload `afterRead` should cover all three; confirm with a quick test before shipping.

### Attachments polymorphism

- `relationTo: ['gpx-files', 'media']` — Payload 3.x supports this on `type: 'upload'`. Verify with a throwaway field first; if it doesn't work cleanly, fall back to two separate arrays (`gpxAttachments` / `fileAttachments`).
- Primary `gpxFile` stays at trail level. It's the auto-calc source (length, elevation, driving). Section attachments are extras only.

### Section draft state

`published: boolean` per row lets editors stash work-in-progress without publishing. Stripped in `afterRead` for non-editors — not just hidden in the UI.

### Slug derivation + collision handling

`slug` is **required but auto-populated** so editors never have to think about it unless they want a custom anchor. Collisions within a single trail are handled deterministically:

- **Source of truth**: a `beforeValidate` collection hook on `trails` runs before Payload validates the doc. For each row in `sections`:
  1. If `slug` is non-empty and was set by the editor, keep it (but still run it through the dedupe pass).
  2. If `slug` is empty, derive from `heading` via a standard slugify (lowercase, strip non-`[a-z0-9-]`, collapse whitespace to `-`). Example: `"Getting There (1st attempt)"` → `getting-there-1st-attempt`.
  3. **Dedupe pass**: walk the sections array top-to-bottom, maintain a `Set<slug>`. If a slug is already in the set, append `-2`, `-3`, … until unique. First occurrence keeps its base slug.
- Order-stable: as long as row order is stable, the suffixed slugs stay stable across re-saves, so anchor links don't break.
- The port script uses **the same derivation function** so DB-land and port-land agree.
- Editor-authored custom slugs that collide get the same `-2`/`-3` treatment rather than a validation error — avoids blocking saves on accidental dupes. (Alternative: error on collision. Lean "auto-resolve"; swapping later is cheap.)

Optional hardening: also run the hook on `sections[].heading` changes so renaming a heading re-slugifies when the editor cleared the slug. Low priority — editors who care will edit the slug by hand.

## 3. Gallery — Phase A

One gallery per trail, trail-level field, React Router view-transitions for the morph animation.

Reference: https://reactrouter.com/how-to/view-transitions

- `trail.gallery` array (see §2) is the source of truth.
- Render on the detail page as a thumbnail grid. Each thumbnail is a `<Link to={'/trails/:slug/photo/:mediaId'} viewTransition>` with `style={{ viewTransitionName: 'photo-<mediaId>' }}` on the `<img>`.
- Nested route `apps/web/app/routes/trails.$slug.photo.$photoId.tsx` renders the full-size view. Same `viewTransitionName` on the big img → the browser animates the morph.
- Parent route stays mounted underneath; closing the photo view pops back to the grid.
- Swipe / arrow-key nav between photos is a follow-up, not blocking.

**Why not a lightbox library**: deep-linkable (each photo has its own URL), share-friendly, zero JS dependency for the core transition, and it's the idiomatic React Router pattern.

**Gotchas**:

- View Transitions API needs Chrome / Edge / Safari 18+. Firefox degrades to a regular nav without animation — acceptable.
- `view-transition-name` must be unique per element **on the rendered page at the moment of navigation**. One gallery per trail → we're fine with `photo-<mediaId>`. (This is the concrete reason v1 of the gallery is trail-level, not per-section. Per-section inline galleries would need composite names like `photo-<sectionIdx>-<mediaId>` — revisit in Phase B.)
- First server render has no transition (expected — it's a same-origin SPA feature).

## 4. Port script — Phase A

New script: `scripts/migrate-sections.ts`. Does not replace `migrate.ts`; runs after it so trails + media already exist.

Pipeline per trail:

1. Load cached issue body + comments from `.cache/github-data.json`.
2. **Body → public sections**:
   - Text before the first H2 (if any) becomes an implicit section with `heading: 'Overview'`, `sourceRef: 'body-preamble'`.
   - Each `## ` H2 chunk becomes a section. `heading` = the H2 text, `sourceRef: 'body-h2-<zero-based-index>'`, `visibility: 'public'`.
3. **Comments → members-only sections**:
   - Only comments with `section:` in frontmatter.
   - Only comments with `status: live` (draft comments are skipped — matches current prod behavior).
   - `heading` = frontmatter `section`. `sourceRef: 'comment-<github-comment-id>'`. `visibility: 'members'`.
4. **Ordering**: body-derived sections first, then comment-derived sections appended — matches current prod render order. Don't interleave.
5. **Per-section body cleanup**:
   - Rewrite GitHub image URLs → CDN URLs (reuse the rewrite already implemented for flat `content`).
   - Inline images are **left in the section body** — Markdown renders them in place. No auto-extraction to gallery.
   - `.gpx` and other download links are **also left inline in the body** (scope cut). Editors promote them to `section.attachments` manually through the admin UI.
6. **Gallery population**: **skipped by the port script** (scope cut). Populating `trail.gallery` requires downloading each image and uploading to the Media collection, which is heavy and error-prone. Editors curate galleries manually through the admin UI. The view-transitions gallery UI still works — it just operates on whatever editors put there.
7. **Upsert**: PATCH the trail. Sections are upserted keyed on `sourceRef`, not `heading`. Sections present in the DB with a `sourceRef` that's no longer produced by the port are **deleted** (stale removal). Sections in the DB with no `sourceRef` (editor-authored) are left untouched.

### "Consecutive images" heuristic (deferred)

Originally speced to auto-wrap consecutive standalone images into a `GalleryBlock`. Cut from the Phase A port script (see step 6). If we ever want auto-population later: standalone = line containing only `![](url)`, run = 2+ such lines separated only by whitespace. For now, editors do it manually.

### Idempotency

- Upsert key: `(trail.id, section.sourceRef)`.
- Renaming a heading in the CMS does **not** cause a duplicate on re-run.
- `--dry-run` prints, per trail: sections to create, update, delete. Ship dry-run before the wet run for 32 trails.

### Flags

```
pnpm migrate-sections                # dry-run by default — prints diff, writes nothing
pnpm migrate-sections --commit       # actually write
pnpm migrate-sections --trail <slug> # single trail for iteration (works with or without --commit)
```

### Dropped on the floor (by design, for now)

- GitHub comment author attribution. Acknowledged loss; add back as a `sourceAuthor` field later if anyone misses it.
- Exotic GFM (task lists, footnotes). `react-markdown` with `remark-gfm` handles most of this already — no special action needed.

## 5. Web app rendering — Phase A

- `apps/web/app/routes/trail-detail.tsx` currently renders `content` via `react-markdown`. Update to iterate `sections` and render each `body` through the same pipeline, prefixed by an `<h2 id={section.slug}>` for TOC anchors.
- For a section where `afterRead` stripped `body` (locked), render a members-only stub with a CTA. Heading + TOC entry still present; show a lock icon in the TOC next to it.
- Add a small TOC component above the first section. Anchor links to `#<section.slug>`. Free lunch once sections are structured.
- New nested route `trails.$slug.photo.$photoId.tsx` for the gallery detail view (§3).
- Fallback: during transition, render the old `content` field if `sections` is empty — lets us deploy the schema + web change before running the port in prod without a dark window.

### Loader depth

Payload populates relationships based on `depth`. Sections contain `attachments` (uploads) and the trail contains `gallery` (uploads). Default depth should cover both but test response size once populated — a trail with 6 sections × 2 attachments + 20 gallery images will balloon the JSON. Not a blocker; flagged for post-port inspection.

## 6. Rollout sequencing — Phase A

All schema changes go through `pnpm migrate:create` (per `feedback_no_handwritten_migrations.md` — never hand-write).

1. Add `sections`, `gallery`, `sourceRef` field, `afterRead` gating hook. Keep `content` and `photos` as-is (don't remove).
2. Generate migration via CLI. Review, land.
3. Web app: render `sections` when non-empty, fall back to `content`. Gallery route added (reads `gallery` when non-empty, falls back to `photos`).
4. Run `migrate-sections --dry-run` locally against a staging DB restore. Eyeball 3–5 trails in admin.
5. Run for real against staging. Manual QA on a handful of trails, including at least one with members-only comments and one with lots of photos.
6. Run against prod.
7. Follow-up PR: mark `content` and `photos` as deprecated in admin (read-only, hidden from editors by default). Keep the columns in DB for one release cycle as an archive.
8. Release after that: drop `content` and `photos` columns via a second generated migration.

## 7. Phase B — Lexical (scoped, not implemented)

After Phase A is stable, swap markdown sections for Lexical. Scope sketch:

- `sections[].body` becomes `type: 'richText'` with `UploadFeature` for inline images.
- New `GalleryBlock` as a Lexical block so galleries can live inside sections, not just trail-level. Handles the `view-transition-name` uniqueness with composite names (`photo-<sectionIdx>-<mediaId>`).
- Port-forward: write a one-time script that converts existing markdown section bodies → Lexical JSON using `@payloadcms/richtext-lexical`'s markdown converter. Spot-check every trail.
- Web app: swap `react-markdown` for `@payloadcms/richtext-lexical/react` RichText + a custom renderer for GalleryBlock.
- Trail-level `gallery` field stays as the "primary gallery" even after inline blocks ship — editors get to choose per trail.

Phase B is a bigger hunk of work (markdown → Lexical conversion fidelity, new editor UI, new renderer). Keeping it out of Phase A means we ship the sectioning + gating + gallery within one PR stack without blocking on the editor swap.

## 8. Open questions

1. ~~**Gallery reference**~~ — answered: React Router view transitions (https://reactrouter.com/how-to/view-transitions).
2. ~~**Gating model**~~ — answered: H2s public, separate comments members-only; `status: live` is orthogonal publish toggle.
3. ~~**`trails.photos` subsumption**~~ — answered: it's used at `trail-detail.tsx:283-303` and `api.server.ts:120-127`. Pre-prod, so rename straight across to `gallery` and update both call sites in the same PR.
4. **Verify `type: 'upload'` with polymorphic `relationTo: ['gpx-files', 'media']`** works in Payload 3.x + the D1 adapter before committing to that schema. Fallback is two separate arrays. (Verification happens during implementation; not a planning blocker.)
5. ~~**Dry-run default**~~ — answered: dry-run by default, `--commit` required for writes.
6. ~~**Section slugs**~~ — answered: required + auto-populated. Collisions resolved by a `beforeValidate` hook that dedupes with `-2`/`-3` suffixes (see §2 "Slug derivation + collision handling").
7. ~~**`photos` / `content` retention**~~ — answered: drop in the release after the port (keep one release as archive in case of rollback, then generated migration drops them).
8. ~~**Locked-section UX**~~ — answered: show heading + lock icon + CTA. Members-only TOC entries stay visible with a lock indicator.
