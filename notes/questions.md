# BLR Hikes v2 - Planning Questions

Since the focus is on **trails listing with rich filtering first**, here are my questions organized by topic. Please answer inline below each question.

---

## 1. Data Source & Content

### 1.1 GitHub Issues as CMS

The trail data currently lives in `shreshthmohan/blrhikes-data` as GitHub issues with YAML frontmatter. I see 32 trails with `trail` + `status:live` labels.

**Q: Do you want to keep GitHub Issues as the source of truth for trail data?** i.e. build the site to fetch from the GitHub API at build time (static generation) or at runtime? Or do you want to migrate this data into a database/CMS like PayloadCMS (as mentioned in plan.md)? migrate to payloadcms

### 1.2 Data Consistency

Looking at the trail issues, the frontmatter schema isn't fully consistent across all trails. For example:

- Older trails (e.g. #19) are missing `area`, `access`, `highlights` fields
- Some have `newTrailLayout: true`, others don't
- The `highlights` field uses different terms (e.g. `scramble`, `cave`, `forest`, `lake`)

**Q: Should we normalize the data as part of the build, or do you plan to clean up the GitHub issues first?** let's normalize the data.

### 1.3 Content Sections

The body of each trail issue has markdown content with sections like Overview, Photos, Trail description, Season, Permit, Wildlife, Getting there, etc.

**Q: For the initial trails listing page, which frontmatter fields should be visible on the card?** From what I see on the current site, a trail card shows:

- Title, area/location
- Cover image
- Difficulty
- Rating
- Distance (length)
- Elevation gain
- Driving time & distance from Bangalore
- Hiking duration
- Highlight tags (lake, cave, forest, etc.)

Is that right? Anything to add or remove? we should also add a "cateogry" or should it be similar to tags? beginner-friendly, challenging, pet-friendly, lake, waterfall, cave, rock-shelter, wild-camping, swimming

---

## 2. Filtering & Search

### 2.1 Filter Dimensions

The current site filters by difficulty only. You mentioned "rich filtering" for v2.

**Q: Which of these filter dimensions do you want?**

- [x] Difficulty (easy, moderate, moderate-hard, hard)
- [x] Highlights/tags (lake, cave, forest, waterfall, temple, scramble, camping, kid-friendly, etc.)
- [x] Access type (open access, permit required, tracked, restricted, unmonitored)
- [ ] Driving distance from Bangalore (range slider or buckets like <50km, 50-100km, >100km)
- [ ] Driving time (range or buckets)
- [x] Hiking duration (range or buckets)
- [ ] Rating (min rating filter)
- [x] Area/region (Ramanagara, Kanakapura, Kolar, etc.)
- [ ] Others?

for the ones not marked, we do them later because they need more though on how to implement. for example driving distance has to be relative to the user's current/chosen location

### 2.2 Sorting

**Q: What sorting options do you want?**

- [ ] Rating (high to low)
- [ ] Distance from Bangalore (near to far)
- [x] Difficulty (easy to hard)
- [x] Hiking time (short to long)
- [ ] Alphabetical
- [ ] Others? do you have recommendations?

### 2.3 Text Search

**Q: Do you want a text search bar to search trail names/descriptions, or are filters sufficient for now?** search too yes, only for the trail title +/ area

---

## 3. Tech Stack (for trails-first approach)

### 3.1 Framework

plan.md says Remix.

**Q: Still going with Remix? Or open to alternatives like Next.js, Astro, or even a simple Vite + React SPA?** Since the initial focus is just a trails listing, a simpler setup might get us to v1 faster. remix, but i am open to using astro, if we can offer a smooth and fast experience (look at the rest of the context to figure this out or recommend choices)

### 3.2 Data Fetching Strategy

**Q: Should the trail data be:**

- **Static (build-time):** Fetch all issues at build time, generate static pages. Fast, but requires rebuild to update content.
- **SSR (server-side):** Fetch from GitHub API on each request (with caching). Always fresh, but adds latency.
- **Hybrid:** Static listing page, but fetch individual trail details on demand.
- **Prebaked JSON:** A build script that pulls all issues into a JSON file that ships with the app.

the data will be paywalled. so what do you think makes most sense?

### 3.3 Hosting

**Q: Still targeting Cloudflare Workers/Pages? Or fine with Vercel/Netlify for now?** cloudflare. react router v7, astro, payload all can be on cloudflare workers/pages

---

## 4. Design & UX

### 4.1 Layout

**Q: For the trails listing, do you want:**

- Grid of cards (like current site)?
- List view?
- Both with a toggle? this

### 4.2 Mobile

**Q: Mobile-first design? The current site seems responsive. Any specific mobile considerations?** same

### 4.3 Map View

**Q: Do you want a map view of all trails (pins on a map) as part of the initial build, or is that a later feature?** yes, but later

---

## 5. Access Control (for later, but affects architecture)

### 5.1 Gating on Trails List

**Q: On the listing page, should all trails be visible (with some info hidden), or should some trails be completely hidden from non-paying users?**

On the current site it seems like all 32 trails are visible in the listing, but detail pages are gated. Is that the plan for v2 as well? some info is visible to all. the critical location identifying info will be hidden (exact start location, gpx file, trail map link etc., we can go over the details)

---

## 6. Scope for Phase 1

**Q: To confirm, Phase 1 is strictly:**

1. Trails listing page with rich filtering
2. Trail detail pages (even if ungated for now)
3. No auth, no payments, no events, no blog

Is that correct? Any other pages needed for Phase 1 (e.g. homepage, about)?
