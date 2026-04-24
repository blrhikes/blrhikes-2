# Cloudflare Workers Deploy — One-Time Setup

This is a step-by-step for bootstrapping both apps (`apps/cms`, `apps/web`) on Cloudflare Workers via the **dashboard's GitHub integration**. After this is done, pushing to `main` auto-deploys via the CI workflow that Cloudflare sets up inside your repo.

Two apps, two environments each:

| App           | Env    | Worker name            | Domain                         |
|---------------|--------|------------------------|--------------------------------|
| `apps/cms`    | test   | `blrhikes-cms-test`    | `cms-test.blrhikes.in`         |
| `apps/cms`    | live   | `blrhikes-cms-live`    | `cms.blrhikes.in`              |
| `apps/web`    | test   | `blrhikes-web-test`    | `test.blrhikes.in`             |
| `apps/web`    | live   | `blrhikes-web-live`    | `blrhikes.in`                  |

The CMS also needs a D1 database and an R2 bucket **per environment** — 4 total:

| Env    | D1 database name    | R2 bucket name      |
|--------|---------------------|---------------------|
| test   | `blrhikes-test`     | `blrhikes-test`     |
| live   | `blrhikes-live`     | `blrhikes-live`     |

> Names are referenced by `apps/cms/wrangler.jsonc`. If you rename in the dashboard, update the wrangler file to match.

---

## 0. Before you start

- Make sure `blrhikes.in` is added as a zone in the same Cloudflare account you'll be deploying to. The custom domains in wrangler.jsonc (`blrhikes.in`, `cms.blrhikes.in`, `test.blrhikes.in`, `cms-test.blrhikes.in`) will be attached to the Workers as Custom Domains — no separate DNS record needed, the dashboard wires A/AAAA for you.
- You'll need your **Account ID**. Grab it from the right sidebar of the CF dashboard home (or `Workers & Pages → Overview`).
- The repo must be pushed to GitHub under an account/org CF can access.

## 1. Paste your account id into the wrangler configs

Open both files and replace `<YOUR_CLOUDFLARE_ACCOUNT_ID>`:

- `apps/cms/wrangler.jsonc`
- `apps/web/wrangler.jsonc`

Commit this after you create the D1 databases in step 2 (you'll update the D1 `database_id`s then).

## 2. Create the D1 databases + R2 buckets

CLI is faster and scripts cleanly. Authenticate once with `wrangler login` (opens browser), then run the commands below. Dashboard steps are also listed as a fallback.

### Auth (one-time)

```bash
# From repo root
pnpm --filter cms exec wrangler login
# Opens a browser → authorize wrangler against your CF account
```

All `wrangler` commands below are run via the cms package so they use the same pinned version as deploys.

### D1 (both envs)

```bash
# Create — APAC location hint routes the primary replica to the closest region (BOM).
pnpm --filter cms exec wrangler d1 create blrhikes-test --location=apac
pnpm --filter cms exec wrangler d1 create blrhikes-live --location=apac
```

Each `create` command prints a block like:

```
✅ Successfully created DB 'blrhikes-test' in region APAC
Created your new D1 database.

[[d1_databases]]
binding = "D1"
database_name = "blrhikes-test"
database_id = "97df08dc-07ad-4bfb-a89e-fd1156758e68"
```

Copy the `database_id` values and paste them into `apps/cms/wrangler.jsonc`:

- `env.test.d1_databases[0].database_id` ← id from `blrhikes-test`
- `env.live.d1_databases[0].database_id` ← id from `blrhikes-live`

Verify:

```bash
pnpm --filter cms exec wrangler d1 list
```

<details>
<summary>Dashboard fallback</summary>

1. **Workers & Pages → D1 SQL Database → Create**
2. Name: `blrhikes-test`, location: closest to Bangalore (BOM is a good default).
3. Copy the **Database ID** from the DB detail page.
4. Paste into `apps/cms/wrangler.jsonc` → `env.test.d1_databases[0].database_id`.
5. Repeat for `blrhikes-live`.
</details>

### R2 (both envs)

```bash
# Create. --location=apac is a hint, not a guarantee — CF picks the nearest
# cluster in the hinted region. Safe to omit if you don't care.
pnpm --filter cms exec wrangler r2 bucket create blrhikes-test --location=apac
pnpm --filter cms exec wrangler r2 bucket create blrhikes-live --location=apac
```

R2 bucket names are global-per-account, not global-per-CF, so you'll get one even if the name is taken elsewhere. Public access is **disabled by default** — the CMS serves files through the worker's R2 binding, so leave it that way.

Verify:

```bash
pnpm --filter cms exec wrangler r2 bucket list
```

<details>
<summary>Dashboard fallback</summary>

1. **R2 → Create bucket**
2. Name: `blrhikes-test`, location hint: APAC/BOM.
3. Public access: **disabled** (CMS serves files through the worker's R2 binding).
4. Repeat for `blrhikes-live`.
</details>

Commit the wrangler.jsonc updates (D1 ids are the only real change).

## 3. Create the 4 Workers via GitHub integration

Do this four times — once per entry in the table at the top.

1. **Workers & Pages → Create → Workers → Connect to Git**
2. Select your GitHub account, pick the `blrhikes-2` repo, and authorize CF to access it (first time only).
3. **Project name**: use the worker name from the table (e.g. `blrhikes-cms-test`). This must match the `name` in the wrangler env block.
4. **Production branch**:
   - `test` workers → track a branch like `main` or `backend-v1` (whichever you want to auto-deploy to test from)
   - `live` workers → track `main` (or a `production` tag/branch)
5. **Build command** (per app):
   - CMS: `pnpm install --frozen-lockfile && pnpm --filter cms build:cf`
   - Web: `pnpm install --frozen-lockfile && pnpm --filter web build`
6. **Build output directory**: leave as default — wrangler handles it based on `main` in the jsonc.
7. **Root directory**: `apps/cms` or `apps/web` respectively.
8. **Wrangler env flag**: under `Settings → Builds`, set the deploy command to `wrangler deploy --env=test` (or `--env=live`). This tells Cloudflare which env block in wrangler.jsonc to use.
9. **Build-time env var (CMS only)**: under `Settings → Builds → Variables`, set `CLOUDFLARE_ENV=test` on the test worker and `CLOUDFLARE_ENV=live` on the live one. `build:cf` forwards this to `opennextjs-cloudflare build --env=$CLOUDFLARE_ENV` so OpenNext picks up the right env block from wrangler.jsonc.
10. **Create & Deploy**. First deploy will likely fail until you set secrets (next step) — that's fine.

> **Why `build:cf` and not `build`?** `pnpm --filter cms build` runs `migrate:prod && next build`. The migrate step would try to hit D1 at CF's build-container level (no bindings available there) and fail. `build:cf` is the CF-dashboard-friendly variant: it only runs `opennextjs-cloudflare build`, which packages `.open-next/worker.js`. DB migrations happen separately via `deploy:database` against the deployed worker's bindings (§7).

## 4. Set per-worker secrets

The CMS needs a `PAYLOAD_SECRET` (random 64-char string). Set one per env.

Each CMS worker → **Settings → Variables and Secrets → Add**:

- `PAYLOAD_SECRET` (type: Secret) → paste `openssl rand -hex 32` output. **Use different secrets for test vs live.**

Do the same if any other runtime secret surfaces later (e.g. `HERE_API_KEY` for driving calculations — check `apps/cms/src/lib/driving.ts`).

The Web worker doesn't need secrets for now. `CMS_URL` is already in the `vars` block of wrangler.jsonc and will be set by the deploy.

### Variables reference — what lives where

Cloudflare Workers has three distinct "places" a variable can come from, and they're not interchangeable. Getting them mixed up is the #1 way deploys look like they work but the worker misbehaves.

| Source | Set via | Visible at | Contents |
|--------|---------|------------|----------|
| **Build-time env** | Dashboard → worker → `Settings → Builds → Variables` | Build container only. **Not** at runtime. | `CLOUDFLARE_ENV` — drives `opennextjs-cloudflare build --env=$…` and any other `$…` expansion in your build command. |
| **wrangler.jsonc `vars`** | `env.<name>.vars` in `wrangler.jsonc` (committed) | Worker runtime, as `env.FOO` in worker code. Public (anyone can read via bundle inspection / dashboard). | Plain configuration: `CMS_URL`, `WEB_URL`. |
| **Wrangler secrets** | Dashboard → worker → `Settings → Variables and Secrets → Add (type: Secret)`, or `wrangler secret put FOO --env <env>` | Worker runtime, same `env.FOO` shape. Encrypted at rest. | `PAYLOAD_SECRET`, any API keys (`HERE_API_KEY`, etc.). |

Bindings (D1, R2, KV, Service Bindings) are a fourth thing — declared in `wrangler.jsonc` env blocks, injected into `env` at runtime, never exposed to your code as strings.

#### Per-app cheatsheet

**`apps/cms` CMS worker**

| Variable | Phase | Type | Where set | Required? |
|----------|-------|------|-----------|-----------|
| `CLOUDFLARE_ENV` | build | build-env | Dashboard → `Settings → Builds → Variables` — set to `test` or `live` per worker | Yes |
| `WEB_URL` | runtime | plain var | `env.test/live.vars` in `apps/cms/wrangler.jsonc` | Yes |
| `CMS_URL` | runtime | plain var | same | Yes |
| `PAYLOAD_SECRET` | runtime | secret | Dashboard → `Variables and Secrets` (different value per env) | Yes |
| `HERE_API_KEY` | runtime | secret | Dashboard → `Variables and Secrets` | Only if driving calcs are enabled (`apps/cms/src/lib/driving.ts`) |
| `D1` binding | runtime | binding | `env.*.d1_databases` in wrangler.jsonc | Yes |
| `R2` binding | runtime | binding | `env.*.r2_buckets` in wrangler.jsonc | Yes |

**`apps/web` Web worker**

| Variable | Phase | Type | Where set | Required? |
|----------|-------|------|-----------|-----------|
| *(none)* | build | — | — | The web build is pure Vite — no build-time env vars needed |
| `CMS_URL` | runtime | plain var | `env.test/live.vars` in `apps/web/wrangler.jsonc` | Yes |

#### Common gotcha

Do **not** put `CLOUDFLARE_ENV` in wrangler.jsonc `vars` thinking it'll reach the build — `vars` is runtime-only. The build command `build:cf` expands `$CLOUDFLARE_ENV` from the build container's shell, which only gets populated from Dashboard → `Settings → Builds → Variables`.

## 5. Bind D1 + R2 to the CMS workers

Bindings are declared in `apps/cms/wrangler.jsonc` per env — CF will pick them up on deploy. But you need to verify the D1 database names and R2 bucket names in the dashboard match what's in the jsonc. If they don't, deploys will 500 with "binding not found".

For each CMS worker → **Settings → Bindings** after the first successful deploy:

- Confirm `D1` binding points at the right DB (`blrhikes-test` or `blrhikes-live`).
- Confirm `R2` binding points at the right bucket.

If anything's missing, the fix is usually to edit wrangler.jsonc and push again.

## 6. Attach custom domains

The wrangler.jsonc `routes` block with `"custom_domain": true` tells CF to add the domain automatically on deploy. If you're deploying via the dashboard (not CLI), you may need to confirm this manually:

Each worker → **Settings → Domains & Routes → Add Custom Domain**:

- `blrhikes-cms-test` → `cms-test.blrhikes.in`
- `blrhikes-cms-live` → `cms.blrhikes.in`
- `blrhikes-web-test` → `test.blrhikes.in`
- `blrhikes-web-live` → `blrhikes.in`

First time you add a custom domain for a zone on the same CF account, it's near-instant. DNS propagates within minutes.

## 7. Run the first migration against the remote D1

Once the CMS is deployed to test, you need to run the Payload migration so the schema actually exists in the test D1:

```bash
# From repo root
cd apps/cms
CLOUDFLARE_ENV=test pnpm deploy:database
```

This runs `payload migrate` against the remote D1 via the bindings in wrangler.jsonc, then a `PRAGMA optimize` to keep SQLite happy. Run again with `CLOUDFLARE_ENV=live` after the live worker is up.

Wrangler uses your local CF auth (`wrangler login` once) — the GitHub integration deploys worker code but does not touch the DB.

**Local equivalents** (handy for day-to-day, not used at deploy):

- `pnpm migrate` → `payload migrate` against the local `.wrangler/state/` miniflare D1.
- `pnpm migrate:create` → generate a new migration file from the schema diff.

Both wrappers prefix `CLOUDFLARE_ENV=local` so they find the `env.local` bindings in wrangler.jsonc. Run them from repo root — they're thin aliases for the cms-package scripts.

## 8. Smoke test

Hit each domain:

- `https://cms-test.blrhikes.in/admin` → should show Payload's first-user setup (empty D1).
- `https://cms-test.blrhikes.in/api/users/me` → should return `{"user":null,"message":"Account"}`.
- `https://test.blrhikes.in` → should render the web app, loader fetching from `cms-test.blrhikes.in`.

Once both test domains are healthy, repeat for `live`.

## 9. Seed the test CMS (optional)

Follow the runbook's `§0. Fresh seed` (`docs/content-sections-runbook.md`) pointing at the test CMS:

```bash
CMS_URL=https://cms-test.blrhikes.in \
CMS_API_KEY=<test-admin-api-key> \
  pnpm --filter scripts seed
```

---

## What this does NOT cover

- **GitHub branch strategy**: you decide which branch maps to which env. Rough default: `main` → live, `backend-v1` (or any feature branch) → test.
- **Rollback**: CF Workers keeps the last N deploys — roll back via the dashboard's "Deployments" tab on the worker. No config needed.
- **Secrets rotation**: re-run the secret-set step with a new value. Next deploy picks it up.
- **Preview deploys per PR**: not configured. Every push to the tracked branch triggers one deploy. Add a preview pattern later if wanted.

## Useful dashboard links

Replace `<ACCOUNT_ID>` with yours:

- Workers overview: `https://dash.cloudflare.com/<ACCOUNT_ID>/workers/overview`
- D1: `https://dash.cloudflare.com/<ACCOUNT_ID>/workers/d1`
- R2: `https://dash.cloudflare.com/<ACCOUNT_ID>/r2/overview`
