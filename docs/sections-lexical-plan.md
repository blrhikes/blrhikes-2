# Section bodies → Lexical rich text (with inline images)

Working plan. Delete after the change ships.

## What's changing & why

Today: `sections[].body` is a `textarea` storing markdown. Inline images
arrive as markdown `![](...)` pointing at external URLs (GitHub asset CDN).
The trail-level `gallery` is a separate curated strip — unrelated to sections.

Want: `body` becomes a Lexical rich-text field. Editors add images **inline,
inside the section body**, via the editor's upload node — no per-section
gallery sub-field, no markdown.

Why: WYSIWYG authoring; images live where they belong in the prose; uploads
go through the Media collection so they get the same R2 + CDN treatment as
the cover image, plus alt text discipline.

## Open questions (answer before I start coding)

1. **Existing section bodies.** Pre-launch, are there any *editor-authored*
   sections (i.e. `sourceRef` empty) in the production CMS? If no, easiest
   path is: update `migrate-sections.ts` to emit Lexical JSON, then re-run
   `seed:sections --commit`. The script's `sourceRef`-keyed upsert handles
   the rest. If yes → we need a one-shot upgrader for those rows too.

2. **Legacy inline images** (GitHub-CDN URLs in current markdown bodies).
   Three options:
   - **(a) Download + upload to Media**, reference via Lexical upload node.
     Best long-term — uniform with how new images will be authored — but the
     port script grows a media-upload pass.
   - **(b) Plain external `<img>` in the Lexical body** (HTML node or a
     thin custom node). Cheap; loses pipeline benefits.
   - **(c) Drop them**. Re-add manually as part of trail QA. Most realistic
     pre-launch since most issues only have 1-3 images.

   My vote: **(c)** for the first cut, then **(a)** if it's painful.

3. **Lexical feature set.** Default plan: headings H3-H6 (H2 stays the
   section heading), paragraph, bold/italic/strike, links, ul/ol,
   blockquote, hr, inline image upload (`relationTo: media`). Skip tables,
   code blocks, columns unless you want them.

4. **Trail-level `gallery` field — leave it?** It's a separate curated
   photo strip rendered at the bottom of the page. Your "not as a gallery
   separately in the section" comment was about per-section galleries; the
   trail-level one is unaffected. Confirm we keep it.

## CMS schema change

`apps/cms/src/collections/Trails.ts` — flip `sections[].body`:

```ts
{
  name: 'body',
  type: 'richText',
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures,
      UploadFeature({ collections: { media: { fields: [...] } } }),
      // disable H1/H2 to keep the section-heading hierarchy clean
    ],
  }),
  admin: { description: 'Section body. Add images inline.' },
}
```

Notes:
- Lexical `body` stores `{ root: { children: [...] } }` JSON.
- DB column for `body` is already TEXT (textarea also TEXT) — but Payload
  *does* generate a migration for the field-type change because the schema
  diff includes the column's logical type. **Per the project rule**, run
  `pnpm --filter cms payload migrate:create` to generate it; don't hand-write.
- `afterRead` gating hook (line ~496 in Trails.ts) still works: setting
  `body = null` on gated rows wipes JSON the same as it wiped strings, and
  the FE's `isSectionLocked` check (`visibility === 'members' && !body`)
  is unchanged.

## API normalization (`apps/web/app/lib/api.server.ts`)

The existing `sections[]` normalizer (line ~132) handles `attachments`. Add
a walk over `body.root` that absolutizes any upload-node URLs the same way:

```ts
// inside the section map:
const body = absolutizeLexicalUploads(s?.body, cmsUrl);
return { ...s, body, attachments };
```

`absolutizeLexicalUploads` recurses children, finds nodes with
`{ type: 'upload', value: { url } }`, and rewrites `/foo` → `${cmsUrl}/foo`.
Idempotent on already-absolute URLs.

## FE rendering (`apps/web/app/routes/trail-detail.tsx`)

Replace the `<Markdown>{section.body}</Markdown>` block with Payload's
React renderer:

```tsx
import { RichText } from '@payloadcms/richtext-lexical/react';

// inside SectionBlock:
{section.body && <RichText data={section.body} converters={converters} />}
```

`converters` overrides:
- `upload` → render `<img src={node.value.url} alt={node.value.alt} loading="lazy" />`
  with our existing prose styling. Wrap in `<figure>` if `node.value.caption`.
- `link` → add `target="_blank" rel="noopener noreferrer"` for external
  links (matches what `rehypeExternalLinks` does today).
- `heading` (H3+) → keep default; the TOC is unchanged because TOC iterates
  trail-level section headings, not body H3s. **Follow-up:** consider deep
  TOC w/ H3 anchors. Out of scope here.

Add `@payloadcms/richtext-lexical` to `apps/web/package.json`. The React
exports are tree-shaken; bundle impact should be small but worth eyeballing
the build size diff.

## Shared types (`packages/shared/src/types.ts`)

```ts
import type { SerializedEditorState } from 'lexical';

export interface TrailSection {
  // ...
  body?: SerializedEditorState | null;
}
```

`null` retains the "wiped for gated viewer" semantics. Update FE
`isSectionLocked` check stays as-is (`!body` covers both null and missing).

## Migration of existing data

Assuming Q1 = "no editor-authored sections" and Q2 = (c):

1. Update `scripts/migrate-sections.ts`:
   - Replace markdown emission with Lexical JSON.
   - Strip image markdown from input bodies (or leave as text — Lexical's
     markdown ingestion via `@payloadcms/richtext-lexical/lexical/utils` can
     handle `![alt](url)` but produces an upload node referencing nothing,
     which won't validate). Cleanest: regex-strip `![…](…)` before
     conversion, log dropped URLs for manual re-add.
   - Output shape: a Lexical `SerializedEditorState` built from the markdown
     via `convertMarkdownToLexical` (or hand-build a tree of paragraph nodes
     for simplicity).

2. Run `pnpm --filter scripts seed:sections -- --commit`. The
   `sourceRef`-keyed upsert overwrites all script-authored sections in
   place. No DB wipe needed.

If Q1 = "yes, editors have authored sections": separate one-shot
`scripts/upgrade-section-bodies.ts` that fetches every trail, converts any
string `body` to Lexical, writes back. Idempotent (skip rows whose body is
already JSON-shaped).

## Test plan

CMS:
- [ ] Create a new trail. Add a section, type rich text, upload an inline
      image, save. Reload — content + image survive.
- [ ] Toggle a section to Members-only. Hit `/api/trails/<id>` while logged
      out — `body` is `null`, FE shows lock stub.
- [ ] Run `seed:sections -- --commit` against a freshly wiped CMS. Spot-check
      one re-ported trail in admin (sections present, bodies are Lexical
      JSON, images absent or as plain text per Q2).

FE:
- [ ] Trail detail page renders rich-text bodies with correct prose styling
      (matching Tailwind `prose` look).
- [ ] Inline images render at the right spot, lazy-loaded, with alt text,
      and respect `max-width` so they don't overflow on mobile.
- [ ] External links inside section bodies open in a new tab.
- [ ] TOC behaviour unchanged (lists section headings, not H3s).
- [ ] Members-only sections: lock stub renders correctly when logged out;
      full body renders when logged in as a member.
- [ ] No regression in pages that hit the legacy `content` fallback (trails
      with no sections).

## Out of scope / follow-ups

- Deep TOC including H3s within section bodies.
- Backfilling legacy GitHub-CDN images into Media collection (Q2 option a).
- Caption + click-to-zoom for inline images (could route through the same
  `/trail/:slug/photo/:photoId` overlay used by the gallery).
- Removing the legacy `content` textarea field once all trails have
  sections (already noted in `docs/content-port.md` §6).
