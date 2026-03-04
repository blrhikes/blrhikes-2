# CMS Database Migrations

## Running Migrations

From the repo root:

```bash
pnpm migrate
```

This runs `payload migrate` inside the CMS package.

## Dev Mode vs Migrations

Payload has two ways of applying schema changes:

- **Dev mode** (`pnpm dev:cms`) — pushes schema changes directly to D1 without recording them. Fast for development, but the `payload_migrations` table has no record of what was applied.
- **Migrations** (`pnpm migrate`) — runs migration files in order and records each one in the `payload_migrations` table.

If you've been running dev mode, the DB schema is already up to date, but Payload doesn't know that. Running `pnpm migrate` will try to re-run all migrations from scratch and fail because tables already exist.

## Fixing "table already exists" After Dev Mode

When `pnpm migrate` fails because dev mode already applied the schema, you need to manually tell Payload which migrations are already applied.

### 1. Check migration status

```bash
cd apps/cms
npx wrangler d1 execute blrhikes-cms --local --command "SELECT name FROM payload_migrations;"
```

### 2. Mark migrations as already applied

Insert records for every migration that dev mode already handled:

```bash
cd apps/cms
npx wrangler d1 execute blrhikes-cms --local --command \
  "INSERT INTO payload_migrations (name, batch, created_at, updated_at) VALUES
   ('20260226_180637', 1, datetime('now'), datetime('now')),
   ('20260227_073927', 1, datetime('now'), datetime('now')),
   ('20260301_000000', 1, datetime('now'), datetime('now'));"
```

Adjust the migration names to match whatever is already applied in your DB.

### 3. Run migrate again

```bash
pnpm migrate
```

Now it should only pick up genuinely new migrations.

## Creating New Migrations

After changing a collection config (adding fields, etc.):

```bash
cd apps/cms
npx payload migrate:create
```

This generates a migration file in `src/migrations/` based on the diff between your Payload config and the last known schema. Register it in `src/migrations/index.ts`.

## Production

For production (remote D1), replace `--local` with `--remote` in the wrangler commands above, or just deploy and run `pnpm migrate` with the appropriate `CLOUDFLARE_ENV` set.
