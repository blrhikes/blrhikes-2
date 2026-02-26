# Data Migration: GitHub Issues → PayloadCMS

This guide walks through populating your local PayloadCMS with trail data from the `shreshthmohan/blrhikes-data` GitHub repo.

## Prerequisites

- Node.js 22+ (check with `node -v`)
- pnpm installed
- Dependencies installed (`pnpm install` from project root)

## Step 1: Start the CMS locally

```bash
pnpm dev:cms
```

This starts PayloadCMS at `http://localhost:3000`. On first run it will:
- Create a local D1 SQLite database (via wrangler)
- Run migrations to set up the schema

Visit `http://localhost:3000/admin` and create your first admin user when prompted.

## Step 2: Set environment variables

The migration script needs two env vars:

| Variable | Required | Description |
|----------|----------|-------------|
| `CMS_URL` | No | Defaults to `http://localhost:3000` |
| `CMS_API_KEY` | No | Only needed if you've enabled API key auth on the CMS. Not required for local dev with an open CMS. |
| `GITHUB_TOKEN` | No | Optional. Without it, you're rate-limited to 60 req/hr. With it, 5000 req/hr. Only needed if you have many issues or hit rate limits. |

To create a GitHub token (if needed):
1. Go to https://github.com/settings/tokens
2. Generate a **classic** token with `repo` scope (or `public_repo` if the data repo is public)

## Step 3: Run the migration

From the project root:

```bash
# Without any tokens (works for public repos with < 60 issues)
pnpm migrate

# With a GitHub token
GITHUB_TOKEN=ghp_xxxxx pnpm migrate

# With all options
CMS_URL=http://localhost:3000 CMS_API_KEY=your-key GITHUB_TOKEN=ghp_xxxxx pnpm migrate
```

This runs `scripts/migrate.ts` which:
1. Fetches all issues from `shreshthmohan/blrhikes-data` with labels `trail` + `status:live`
2. Parses YAML frontmatter from each issue body (title, difficulty, area, GPS, stats, etc.)
3. Downloads and uploads cover images to the CMS (stored in R2/local)
4. Creates trail entries via the PayloadCMS REST API

## What to expect

```
Fetching issues from GitHub...
Found 32 trail issues

Processing: Anthargange Cave Trek (#1)
  Uploading cover image...
  Creating trail in CMS...
  Done.

Processing: Makalidurga Lake Trek (#2)
  ...

Migration complete: 32 succeeded, 0 failed
```

## Step 4: Verify

1. Visit `http://localhost:3000/admin/collections/trails` to see all imported trails
2. Start the frontend: `pnpm dev:fe`
3. Visit `http://localhost:5173/trails` to see the listing

## Troubleshooting

### "GitHub API error: 403"
You've hit the rate limit. Set `GITHUB_TOKEN` and retry.

### "Failed to create trail: 400"
The CMS rejected the data. Check the error message for which field is invalid. Common causes:
- Duplicate slug (trail already exists) — clear the collection in admin and retry
- Invalid enum value for difficulty/access — check the issue's frontmatter

### "Failed to upload image"
The image URL in the GitHub issue may be broken or the CMS media upload endpoint isn't working. The trail will still be created, just without a cover image.

### CMS not running
Make sure `pnpm dev:cms` is running in a separate terminal before running the migration.

### "No trail issues found"
The script looks for issues with both `trail` AND `status:live` labels. Make sure your issues in the data repo have these labels.

## Re-running the migration

The script doesn't check for existing trails — it always creates new ones. To re-run cleanly:

1. Go to `http://localhost:3000/admin/collections/trails`
2. Select all → Delete
3. Optionally clear media too at `/admin/collections/media`
4. Run `pnpm migrate` again
