# Content Migration

How trail data gets from GitHub Issues into PayloadCMS, and the strategy for evolving the content format.

## Current Pipeline

### Source

Trail data lives in `shreshthmohan/blrhikes-data` as GitHub Issues with:
- Labels: `trail` + `status:live` (32 trails)
- YAML frontmatter in issue body
- Markdown content after frontmatter
- Issue comments with `section` + `status: live` frontmatter = additional trail sections

### Migration Script (`scripts/migrate.ts`)

```bash
pnpm migrate              # Basic run
pnpm migrate --force      # Update existing trails
pnpm migrate --refresh    # Re-fetch from GitHub (ignores cache)
```

What it does:
1. Fetches all issues from `shreshthmohan/blrhikes-data` with `trail` + `status:live` labels
2. Parses YAML frontmatter from each issue body
3. Rewrites GitHub image URLs to CDN URLs (same pattern as v1)
4. Downloads and uploads cover images to CMS Media collection
5. Creates/updates trail entries via CMS REST API
6. Caches GitHub data locally (`.cache/github-data.json`)

### GPX Migration Script (`scripts/migrate-gpx.ts`)

Scans `blrhikes/public/gpx/` directory, uploads `.gpx` files to CMS, links them to trails by slug.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CMS_URL` | No | Defaults to `http://localhost:3000` |
| `CMS_API_KEY` | No | Only if CMS has API key auth enabled |
| `GITHUB_TOKEN` | No | Raises rate limit from 60 → 5000 req/hr |

### Running Locally

```bash
# Terminal 1
pnpm dev:cms

# Terminal 2 (after CMS is up + first admin user created)
pnpm migrate
```

Verify at `http://localhost:3000/admin/collections/trails` and `http://localhost:5173/trails`.

### Re-running

The script doesn't deduplicate by default. To re-run cleanly:
1. Delete all trails in CMS admin
2. Optionally clear media
3. Run `pnpm migrate` again

Or use `--force` to update existing trails (matches by slug).

## Image URL Rewriting

GitHub user-attachment URLs get rewritten to the Cloudflare CDN URL at migration time:

```
Input:  https://github.com/user-attachments/assets/{uuid}
Output: https://blrhikes.com/cdn-cgi/image/width=800,quality=80,format=jpeg/https://images.blrhikes.com/{uuid}
```

No need to download/re-upload — images are already proxied through R2 + Cloudflare Image Resizing from v1.

## Content Format Strategy

### Current: textarea (markdown)

The `content` field is a `textarea` storing a plain markdown string. Frontend renders it with `react-markdown` inside a `prose-stone` Tailwind Typography container.

### Future: Lexical rich text

The plan is to migrate to Payload's `richText` field (Lexical JSON). This is a two-phase approach:

**Phase A (current):** Keep `textarea` with markdown. Fix migration to:
- Rewrite image URLs to CDN URLs ✅ (done)
- Rewrite GitHub issue cross-references (`#42`) to internal trail links
- Extract/handle issue comments as content sections
- Populate `photos` array from inline images

**Phase B (later):** Convert to `richText` (Lexical):
- Change `content` to `type: 'richText'`
- Write one-time migration: markdown → Lexical JSON
- New content authored directly in Payload's rich text editor
- Custom blocks for image galleries, GPX embeds, map embeds

### Why two phases

- Converting GFM → Lexical JSON is fiddly (GitHub-specific markdown features)
- Once content is clean markdown with working CDN URLs, the Lexical migration is much simpler
- Can start using `richText` for new CMS-authored content while legacy stays as markdown

## v1 Reference (How the Old Site Did It)

The original Astro-based site processes markdown at build time through a unified/rehype pipeline:

```
GitHub Issue API → gray-matter (strip frontmatter) → remarkParse → remarkGfm
  → remarkRehype → rehypeRaw → rehypeSlug
  → rehypeTransformImageUrls (CDN rewrite)
  → rehypeLightGallery (group consecutive images)
  → rehypeExternalLinks (target="_blank")
  → rehypeStringify → HTML
```

Key difference: v1 does this every build. v2 does it once at migration time and stores the result.

## Troubleshooting

| Error | Fix |
|-------|-----|
| GitHub API 403 | Set `GITHUB_TOKEN` |
| Failed to create trail: 400 | Check error message — likely duplicate slug or invalid enum |
| Failed to upload image | Image URL may be broken; trail still creates without cover |
| No trail issues found | Check issues have both `trail` and `status:live` labels |
| CMS not running | Start `pnpm dev:cms` first |
