# BLR Hikes v2

Rebuilding the hiking guide platform (blrhikes.com) with a modern stack. Premium trail info, community features, events, content gating, and payments.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React Router v7 (SSR) + TailwindCSS |
| CMS | PayloadCMS (headless) |
| Database | Cloudflare D1 (SQLite) |
| Hosting | Cloudflare Workers |
| Email | Resend (planned) |
| Payments | Razorpay (planned) |
| Images | Cloudflare R2 + Image Resizing (reused from v1) |

## Project Structure

```
apps/
  cms/          PayloadCMS app (collections, migrations, admin)
  fe/           React Router v7 frontend (Cloudflare Workers)
packages/
  shared/       Shared types, constants, enums
scripts/        Migration scripts (GitHub Issues → CMS, GPX upload)
docs/           You are here
```

## Phase Status

| Phase | Status | Summary |
|-------|--------|---------|
| **1. Foundation** | 🟡 Almost done | CMS + FE scaffolded, trails CRUD, migration script, basic UI. Pending: deploy, run migration on live CMS |
| **1.5 Polish** | 🟡 Partial | Stone + Tiempos design applied (light mode). Pending: dark mode |
| **2. Auth & Access** | 🟡 Started | Login/logout routes work, field-level gating on trails implemented. Pending: full auth flow, user dashboard, remaining collections |
| **3. Payments** | 🔴 Not started | Razorpay webhook design doc exists, no code yet |
| **4. Events & Community** | 🔴 Not started | No collections or pages |
| **5. Launch Prep** | 🔴 Not started | Content migration, SEO, testing, production deploy |

## Docs Index

| Doc | What's in it |
|-----|-------------|
| [backlog.md](./backlog.md) | Task tracker — what's done, what's next, open questions |
| [architecture.md](./architecture.md) | Data models, collections, routes, infra decisions |
| [trail-design.md](./trail-design.md) | Trail schema, sections, GPX handling, computed fields |
| [user-roles.md](./user-roles.md) | Roles, access control, Razorpay webhook flow, gated fields |
| [content-migration.md](./content-migration.md) | Strategy + how-to for GitHub Issues → CMS migration |
| [decisions.md](./decisions.md) | Key decisions made, answered questions |

## Quick Start

```bash
pnpm install
pnpm dev:cms    # PayloadCMS at localhost:3000
pnpm dev:fe     # Frontend at localhost:5173
pnpm migrate    # Migrate trail data from GitHub Issues
```
