# CMS Architecture Evaluation: Payload Layer vs. Single React Router App

**Date:** 2026-06-12 (rev 2 — see changelog at bottom)
**Question:** Should the rebuild (replacing legacy `blrhikes` and its GitHub-Issues-as-CMS) be:

- **Option A** — Payload CMS as a separate layer + React Router v7 (framework mode) frontend, two Workers
- **Option B** — One React Router v7 full-stack app on Workers, with CMS/admin functionality built directly into it (Drizzle + D1 + R2)

**Constraints that decide this:**
1. Cloudflare for everything — Workers, D1, R2.
2. **A custom CMS/admin UI will be built in RR7 regardless** — the owner doesn't like Payload's default admin and won't use it as the primary editing surface.
3. **Nothing is in production yet.** The Payload + RR7 split is deployed (cms.blrhikes.in etc.) but serving no real traffic; the legacy app is still the live site. Sunk cost is explicitly off the table.

**TL;DR / Recommendation:** **Option B — single React Router v7 full-stack app on Workers.** Payload's value proposition for an owner-operated app is overwhelmingly its admin UI; reject that, and what's left (schema'd CRUD API, hooks, auth) doesn't justify running a second Worker on the fragile OpenNext + D1-adapter stack — three layers under a year old with documented prod-only bugs — just to put a REST hop between your own admin UI and your own database. Every piece Payload would still provide has a mature, Workers-native replacement, including the previously-scary one (auth: better-auth ≥ 1.5 has native D1 support). The existing Lexical content is portable JSON.

---

## 1. Context: what we're rebuilding and why

The legacy app (`../blrhikes`, Astro + Supabase + GitHub Issues) is being rebuilt without GitHub Issues as the content layer. GitHub Issues failed as a CMS because of: no schema (untyped frontmatter, silent breakage), no admin UI for partners, comments-as-sections conventions, GitHub API rate limits, and images trapped in issue attachments.

The rebuild has to cover:

| Bucket | Features | Nature of the work |
|---|---|---|
| **Content** | Trails (~27, multi-section, gated), events pages, blog (later), media/galleries, GPX files | Rich text, uploads, draft/live status, field-level gating |
| **Commerce** | Event registration, trail purchases, memberships, Razorpay orders + webhooks, discount codes, refunds | Custom endpoints + careful writes — no CMS provides this |
| **Bespoke admin** | Transport/carpool planner, attendee management, expenses/P&L, crew roster, discount code CRUD | Custom UI in either architecture (legacy built these as custom Astro pages too) |
| **Identity** | Member auth, roles (admin/contributor/lifetime/yearly), email-keyed attendee access via tokens | Auth + access control |

Two structural facts dominate the decision:

1. **Most of this app's admin surface was never generic CMS CRUD.** Transport planner, refunds, attendee pickers, discount codes, P&L — all bespoke, in v1 and in any v2.
2. **The editing UI will be custom-built in RR7 either way** (owner's call). So the question is purely: *what backend sits under a custom UI?*

## 2. What Payload provides once you've rejected its admin UI

With a custom admin, Payload reduces to a headless backend: config-driven schema + validation, auto-generated REST CRUD with `where` queries and relationship population, field/row access control, hooks, auth (sessions, password reset, API keys), R2 upload handling, and schema-derived migrations.

That's real functionality — but consider what it costs in this specific setup:

- **A second Worker running Next.js via OpenNext** — the most fragile of Cloudflare's framework paths, with a hard **10 MiB compressed bundle ceiling** (Workers Paid) that the Payload bundle already pressures.
- **Three layers under a year old** stacked beneath your content: the OpenNext adapter, `@payloadcms/db-d1-sqlite` (first published July 2025), and D1 semantics themselves. Documented bugs that only manifest **deployed, not in local dev**: UPDATE failures on wide schemas from D1's 100-bound-params limit ([payload#14766](https://github.com/payloadcms/payload/issues/14766)), silent DELETE failures from stale D1 bindings ([payload#15070](https://github.com/payloadcms/payload/issues/15070)).
- **A REST hop between your own UI and your own data.** Custom RR7 admin → fetch → CMS worker → Payload → Drizzle → D1, with cross-subdomain cookie auth — versus a loader calling Drizzle directly in the same Worker.
- **You'd still hand-build the hard parts.** Payload's Lexical editor field, media library, and form scaffolding live *inside* its admin. A custom UI against headless Payload means embedding Lexical yourself and building upload/relationship pickers yourself — i.e., most of Option B's UI work — while also keeping Payload running.

Community reality check: running Payload fully headless behind a hand-built admin is nominally supported (`admin: { disable: true }`, [docs](https://payloadcms.com/docs/admin/overview)), but the established pattern is customizing *within* Payload's admin shell; no notable public project runs Payload with a fully separate custom admin. People who reject the admin UI generally drop Payload. (Absence of evidence, but a telling one.)

## 3. Can Option B actually replace each piece? (verified June 2026)

| Payload feature | Option B replacement | Maturity |
|---|---|---|
| Auth (email/password, sessions, reset emails, roles, API keys) | **better-auth ≥ 1.5** — native D1 support since Feb 2026, explicitly designed around D1's no-transactions limitation (uses `batch()`); admin plugin for roles; api-key plugin; multiple maintained RR7 + Workers + D1 templates (e.g. [foxlau/react-router-v7-better-auth](https://github.com/foxlau/react-router-v7-better-auth)). [1.5 release](https://better-auth.com/blog/1-5), [RR integration docs](https://better-auth.com/docs/integrations/react-router) | ✅ Solid; the community-preferred path for exactly this stack. Caveats: fast release cadence, no public security audit found. (Lucia is dead-as-a-library since early 2025 — now a learning guide; Auth.js is OAuth-first with second-class credentials support.) |
| Rich text editing | **Standalone `@lexical/react`** in the custom admin — Lexical is Meta's framework-agnostic library, headless by design, actively maintained. [lexical.dev](https://lexical.dev/docs/getting-started/react) | ✅ Mature (still 0.x — pin versions). Existing Payload content is standard Lexical `SerializedEditorState` JSON and ports cleanly; only Payload-specific nodes (upload/relationship/blocks) need re-registering or one-time conversion ([converters](https://payloadcms.com/docs/rich-text/converters)). |
| Schema + validation | Drizzle schema + drizzle-kit migrations + zod validation shared client/server | ✅ De-facto standard on D1 |
| CRUD API + queries | RR7 loaders/actions calling Drizzle directly — no API layer needed at all for a same-app admin | ✅ Simpler than what it replaces |
| Access control (gated sections, member pricing) | Loader/action logic — arguably more natural than Payload field-access hooks | ✅ |
| Uploads | R2 binding direct from actions; presigned or proxied reads | ✅ |
| Drafts/versions | `status` field; **snapshot-on-write table from day one** (history can't be backfilled), diff/restore/autosave UI deferred — see §5.1 | ✅ adequate at this scale, with one capture caveat |
| Hooks (counters, denormalization) | Plain functions in actions, `batch()` for atomicity | ✅ |

Platform footing for B: RR7 framework mode + `@cloudflare/vite-plugin` (GA April 2025) is Cloudflare's most mature full-stack path — dev runs in workerd (dev = prod runtime, which directly prevents the "works locally, fails deployed" class of bug that bites the Payload/D1 stack), bindings in loaders/actions, small bundles. [CF framework guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/)

**Shared constraint either way:** D1 has no interactive transactions ([limits](https://developers.cloudflare.com/d1/platform/limits/)). Razorpay spot-allocation must be single-statement conditional writes (`UPDATE ... WHERE paid_count < max_attendees`) or `batch()` — in B you do this directly and visibly; in A you'd fight to express it through Payload hooks. Advantage B on the single hardest correctness problem in the app.

## 4. Head-to-head (with the real constraints applied)

| Criterion | A: Payload + RR7 split | B: Single RR7 app |
|---|---|---|
| Admin/editing UI | Custom-built anyway — Payload admin unused | Custom-built — same work, minus the REST plumbing |
| Platform maturity on CF | ⚠️ OpenNext + D1 adapter, prod-only bugs, 10 MiB ceiling | ✅ Most mature CF path, dev = prod runtime |
| Architecture | Two Workers, two builds, cross-subdomain cookies, REST hop | One Worker, one build, direct DB access |
| Auth | Payload built-in (proven) | better-auth ≥ 1.5 (proven on this exact stack, younger) |
| Payments/capacity correctness | Through Payload hooks, REST, no transactions | Direct conditional writes / `batch()` — clearest possible expression |
| Schema/validation | Payload config | Drizzle + zod |
| What breaks when upstream moves | Payload×OpenNext×D1-adapter version matrix | drizzle-kit + better-auth (swappable: standard sessions-table pattern) |
| Salvage from current build | — | Web app routes/components/design system, `packages/shared`, mockups, R2 buckets, D1 envs, deploy setup; Trails content as portable Lexical JSON |
| Sunk cost | Explicitly discounted (nothing in prod) | — |

The strongest remaining arguments **for A**, stated fairly:

1. **Schema-by-config and free CRUD** — 10 events collections are faster to declare in Payload than to hand-write tables + queries for. *Counter:* with no admin UI consumed, "free CRUD" has no free consumer; you write the custom UI's data access either way, and Drizzle schema is comparably terse.
2. **Auth is solved and battle-tested in Payload.** *Counter:* better-auth ≥ 1.5 on D1 is now well-trodden with maintained templates; and Payload's auth ships inside the same fragile runtime you're trying to avoid.
3. **A future where partners edit content via a polished admin you didn't build.** *Counter:* the owner has rejected that admin's UX; a custom admin can be made partner-friendly, and that work was committed to regardless.

None of these survive constraint #2. Payload's pitch is "don't build an admin." If you're building one anyway, Payload is overhead with a version-matrix attached.

## 5. Recommendation

**Build the new app as Option B: a single React Router v7 framework-mode app on Cloudflare Workers.**

Concrete stack:

- **App:** RR7 framework mode + `@cloudflare/vite-plugin`, one Worker, three envs (reuse the existing dev/test/live D1 + R2 + domain setup from `wrangler.jsonc`).
- **Data:** D1 + Drizzle + drizzle-kit migrations; zod for validation, types in `packages/shared`.
- **Auth:** better-auth ≥ 1.5 (native D1), admin plugin for roles, Resend for reset emails (keep the existing no-SDK Resend adapter pattern from `apps/cms/src/email/resend.ts`).
- **Admin:** custom routes (e.g. `/admin/*`) in the same app, gated by role — loaders/actions hit Drizzle directly. The transport mockups (`mockups.transport.*`) graduate into this surface.
- **Rich text:** standalone `@lexical/react` editor component; render with a shared Lexical-JSON renderer. Port existing Trails Lexical JSON with a one-time conversion script for Payload-specific nodes (upload/relationship).
- **Uploads:** R2 binding from actions; media table in D1 for metadata.
- **Payments:** Razorpay order + webhook as RR7 actions/resource routes; capacity via single-statement conditional UPDATE; auto-refund backstop per `docs/events-plan.md`.

What carries over from the current build (this is most of it): the entire `apps/web` app shell, routes, design system, mockups, `packages/shared`, Cloudflare account plumbing (D1 databases, R2 buckets, domains, GitHub deploy integration), the Resend adapter pattern, and all the *domain modeling* in `docs/events-plan.md` — the 10-collection design translates 1:1 into Drizzle tables. What gets retired: `apps/cms`, OpenNext, the Payload dependency matrix, and the cross-worker REST client (`apps/web/app/lib/api.server.ts` becomes direct queries).

Migration of existing content: trivial at current volumes (~27 trails, no prod users). Export via Payload REST once, transform Lexical nodes, seed D1 via script. If any real user accounts exist, force a password reset rather than porting Payload's hash format.

### 5.1 Deep-dive: versioning & history (the one row that needs more than a ✅)

Versioning is the feature people reach for to defend Payload against a hand-rolled backend, so it's worth doing properly rather than waving through. It deserves more scrutiny than the §3 table line gives it.

**What Payload's versions/drafts bundle actually is** — six things, not one: (1) auto-snapshot on every save (configurable `max`); (2) draft vs. published split with `_status` handled for you; (3) autosave so an editor doesn't lose work mid-edit; (4) a visual diff + one-click restore in the admin; (5) scheduled publish and draft preview; (6) per-locale versioning (irrelevant here unless trails go multilingual).

**The feature splits cleanly into two halves — and the split *is* this doc's thesis:**

| Half | Where the value lives | Cost to replicate in B |
|---|---|---|
| The **data** — snapshots, draft/published split | a table + a write hook | Trivial: a Drizzle insert in the update action |
| The **UX** — diff viewer, restore button, autosave, scheduled publish, preview | **inside Payload's admin** | Real UI work you'd hand-build |

The expensive, hard-to-replicate half is bolted to the admin UI the owner already rejected (constraint #2). Headless Payload exposes `_versions` over REST, but you'd be fetching that JSON to render your *own* diff viewer and *own* restore flow — the same trap as §2's Lexical/media point: the magic is in the shell you're not using. So versioning **reinforces** Option B's logic rather than undermining it.

**The one genuine soft spot** is the original phrasing "snapshot table *later* if audit history is ever needed." History is append-only by nature, which creates an asymmetry:

> You can build the diff/restore UI later. You cannot recover history you never captured.

If a partner mangles a trail in month 3 and the snapshot table only lands in month 4, the earlier good version is gone. For a **multi-contributor** content app — and partner editing is exactly why GitHub Issues failed in v1 — "who overwrote the elevation gain, and what was it?" is a when-not-if scenario. So "later" is right about the **UI** and wrong about the **capture**.

**Resolution — split it the way Payload does, grab the cheap half on day one:**

- **Day one (~10 lines):** a `trail_versions` table + snapshot-on-write in the update action — append full doc JSON + editor id + timestamp on every save, `batch()`-ed with the main write so it's atomic. History now exists forever.
- **Drafts:** the `status` field §3 already calls for. Adequate as-is.
- **Deferred (the actual UI debt):** diff viewer, restore button, autosave, scheduled publish. Restore from a captured snapshot is just "write the old JSON back" — easy once the data exists.

**Accepted losses vs. Payload:** autosave (theirs is slick; yours is a debounced action or nothing) and scheduled publish (a cron + a `publish_at` column the day you want it). Neither is load-bearing for ~27 owner-operated trails.

## 6. Risks of Option B & mitigations

| Risk | Mitigation |
|---|---|
| You own auth security | Use better-auth's defaults (don't hand-roll hashing/tokens); pin ≥ 1.5; rate-limit login/reset endpoints; it's a standard sessions-table design, so it's swappable if the project disappoints. |
| better-auth is itself young (2024, no public audit) | One young layer at the edge of the system beats three young layers under the content store; the D1-specific failure mode (transactions) is explicitly handled via `batch()` since 1.5. |
| Editor UX debt — your Lexical admin will start rough | Accepted by design (you wanted to own this UI). Start with a minimal node set (headings, lists, links, images); grow as needed. Pin Lexical 0.x versions. |
| No schema guardrails like Payload's config validation | zod schemas at every action boundary; drizzle-kit makes schema changes explicit migrations (CHECK constraints where it matters). |
| "Conventions instead of schema" creep — the GitHub-Issues failure mode, homemade edition | The actual lesson from v1 is *unstructured content + no validation*, not *absence of a CMS product*. D1 tables + zod + migrations are structurally different from frontmatter conventions. Hold that line: no JSON-blob fields for things that deserve columns (the one sanctioned blob: `transport_plan`, per the events plan). |
| D1 no-transactions vs. payments | Same risk in both options; B expresses the fix most directly (conditional UPDATE / `batch()`). Test the overbook race deliberately on the dev env. |
| Losing edit history you can't backfill (no Payload versions) | Snapshot-on-write `trail_versions` table from **day one** — capture is cheap and append-only; defer only the diff/restore UI. See §5.1. |

## 7. What would change this verdict

- You change your mind about building a custom admin and want a maintained editing UI out of the box → Option A comes back, with the §6-style mitigations from rev 1 of this doc (flat collections, `blocksAsJSON`, verify deletes on deployed dev after upgrades, version pinning).
- Payload ships a framework-agnostic admin or first-class RR7 embedding (nothing announced as of June 2026; v4 canary shows no such commitment) → re-evaluate, since the REST-hop and OpenNext taxes would shrink.
- better-auth stalls or a serious vulnerability lands before launch → fall back to hand-rolled sessions on the Lucia-guide pattern (oslo/arctic primitives) — same D1 tables, no architectural change.

---

**Changelog:**
- **rev 3 (2026-06-26):** Added §5.1 deep-dive on versioning vs. Payload's versions/history feature — splits the feature into cheap data-capture vs. admin-bound UX, fixes the "snapshot table later" soft spot (history can't be backfilled), and adds a day-one `trail_versions` capture to the §3 row and risk table.
- **rev 2 (2026-06-12):** Verdict flipped from A to B after two new constraints: (1) a custom CMS UI in RR7 will be built regardless — owner rejects Payload's admin UX; (2) nothing is in production, and sunk cost in the existing Payload build is explicitly discounted. Added verified research on better-auth/D1, standalone Lexical, and headless-Payload patterns.
- **rev 1 (2026-06-12):** Recommended keeping the existing Payload + RR7 split, weighted heavily on the free admin UI and the (then-assumed live) production deployment.

*Sources: [Cloudflare: Payload on Workers](https://blog.cloudflare.com/payload-cms-workers/) · [with-cloudflare-d1 template](https://github.com/payloadcms/payload/blob/main/templates/with-cloudflare-d1/README.md) · payload issues [#14766](https://github.com/payloadcms/payload/issues/14766), [#15070](https://github.com/payloadcms/payload/issues/15070) · [Payload Local API outside Next.js](https://payloadcms.com/docs/local-api/outside-nextjs) · [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) · [CF Vite plugin GA](https://developers.cloudflare.com/changelog/post/2025-04-08-vite-plugin/) · [RR7 on Workers guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/) · [better-auth 1.5 (native D1)](https://better-auth.com/blog/1-5) · [better-auth × React Router](https://better-auth.com/docs/integrations/react-router) · [foxlau RR7+better-auth+D1 template](https://github.com/foxlau/react-router-v7-better-auth) · [Lucia deprecation](https://github.com/lucia-auth/lucia/discussions/1714) · [Lexical](https://lexical.dev/docs/getting-started/react) · [Payload rich-text converters](https://payloadcms.com/docs/rich-text/converters)*
