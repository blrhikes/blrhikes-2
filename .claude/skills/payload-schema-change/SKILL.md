---
name: payload-schema-change
description: Use when modifying PayloadCMS collection schemas — adding, removing, or changing fields in apps/cms/src/collections/. Ensures migrations are generated correctly via the Payload CLI instead of being hand-written.
---

# Payload Schema Change Workflow

When modifying CMS collection schemas (adding/removing/changing fields), follow this exact sequence:

## Step 1: Modify the Collection

Edit the relevant collection file in `apps/cms/src/collections/`. This is where the schema is defined.

## Step 2: Update Shared Types (if needed)

If the field is exposed to the frontend, update the TypeScript interface in `packages/shared/src/types.ts`.

## Step 3: Update Migration Script (if needed)

If the field was part of the GitHub Issues migration, update `scripts/migrate.ts` (parsing + upsert body).

## Step 4: Generate the Migration

**Do NOT hand-write migration files.** Run the Payload CLI to auto-generate:

```bash
cd apps/cms && pnpm payload migrate:create
```

This diffs your schema against the current DB state and generates:
- A new migration file in `apps/cms/src/migrations/`
- Updates `apps/cms/src/migrations/index.ts` automatically

**Requires the dev server's DB to compare against** — make sure you've run `pnpm dev:cms` at least once.

## Step 5: Regenerate Payload Types

```bash
cd apps/cms && pnpm generate:types:payload
```

This updates `apps/cms/src/payload-types.ts` to match the new schema.

## Step 6: Run the Migration

```bash
# Local
cd apps/cms && pnpm payload migrate

# Production (deploys to D1)
cd apps/cms && pnpm deploy:database
```

## Important Notes

- Never manually edit `apps/cms/src/migrations/index.ts` — the CLI manages it
- Never hand-write SQL migration files — the CLI generates them from schema diffs
- Old migrations are historical records — don't modify them even if they reference removed fields
- The DB adapter is `@payloadcms/db-d1-sqlite` (Cloudflare D1 / SQLite)
