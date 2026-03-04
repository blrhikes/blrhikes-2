# Trail Design

## Schema Overview

Trails are the core content entity. Each trail has metadata (frontmatter-style fields), markdown content, media, and computed stats.

## Fields

### Core Fields

| Field | Type | Notes |
|-------|------|-------|
| `title` | text | Trail name |
| `slug` | text | URL slug, auto-generated from title |
| `altName` | text | Alternative/poetic name (e.g. "Forest Cathedral Trail") |
| `area` | relationship (Areas) | Region: Ramanagara, Kanakapura, Kolar, etc. |
| `difficulty` | select | easy, moderate, moderate_hard, hard, very_hard |
| `access` | select | OPEN_ACCESS, PERMIT_REQUIRED, TRACKED_ACCESS, RESTRICTED, UNMONITORED |
| `rating` | number | Trail rating (e.g. 4.5) |
| `highlights` | relationship (Highlights, hasMany) | Tags: lake, cave, forest, waterfall, etc. |
| `status` | select | draft, live |

### Gated Fields (require auth)

| Field | Type | Notes |
|-------|------|-------|
| `gps` | text | Trailhead coordinates |
| `mapLink` | text | GaiaGPS or similar link |
| `gpxFile` | relationship (GpxFiles) | GPX track file |

Access logic: user must be admin, contributor, lifetime member, non-expired yearly member, or have purchased this specific trail.

### Stats Fields (will be computed from GPX via hooks)

| Field | Type | Notes |
|-------|------|-------|
| `length` | text | Trail length (e.g. "3.54 km") |
| `elevationGain` | text | Total elevation gain |
| `elevation` | text | Peak elevation |
| `computedDrivingDistance` | number | km (raw) |
| `computedDrivingDistanceText` | text | Human-readable |
| `computedDrivingTime` | number | seconds (raw) |
| `computedDrivingTimeText` | text | Human-readable |
| `computedActualHikingTime` | number | hours |
| `computedActualTimeIncludingRests` | number | hours |
| `computedActualTimeWithRestAndExploration` | number | hours |
| `computedRoundedHikingTime` | number | hours (rounded) |
| `computedRoundedTimeIncludingRests` | number | hours (rounded) |
| `computedRoundedTimeWithRestAndExploration` | number | hours (rounded) |
| `computedRelativeLocation` | text | Direction from Bangalore (north, south, etc.) |
| `computedRemote` | boolean | Whether the trail is remote |
| `computedLocal` | boolean | Whether it's local |

**Future:** These fields will be auto-calculated using PayloadCMS hooks when a GPX file is uploaded. The plan is Haversine distance calculations (ported from v1's `blrhikes-webhook-listeners`).

**Future (Level 2):** Dynamic driving time from user's location → trailhead via Azure Maps / Google Maps API. Only triggered when user uses sort-by-distance.

### Content

| Field | Type | Notes |
|-------|------|-------|
| `content` | textarea | Markdown string (rendered with `react-markdown` on frontend) |
| `coverImage` | upload (Media) | Single cover image |
| `photos` | array of uploads (Media) | Gallery images |

**Current:** `textarea` with markdown. **Future:** Migrate to Payload's `richText` (Lexical JSON) field. See [content-migration.md](./content-migration.md) for the strategy.

## GPX Files

Multiple GPX files can be associated with a trail:
- One **main GPX** — the complete trail (start/end at parking, full loop)
- Additional GPX files for offroad routes to reach the trailhead/parking spot

## Content Sections (New Trail Layout)

7 of the 32 trails use the `newTrailLayout` format with standardized markdown sections:

1. **Overview** — General description
2. **Photos & Videos** — Media
3. **Trail description** — Detailed walkthrough
4. **Season** — Best time to visit
5. **Permit** — Access/permit requirements
6. **Wildlife** — Animal/bird sightings
7. **Getting there** — Directions to trailhead
8. **Cleanliness** — Trail condition
9. **Crowd** — Crowding info
10. **Eateries on the way** — Food spots nearby (optional)
11. **Exploration notes** — Additional notes (optional)

**Goal:** All trails should eventually follow this section structure. The older trails have freeform markdown bodies.

## Eateries (Future)

Planned as a separate collection, linked from trail sections. Key fields:
- Name, location
- Food quality
- Washroom availability + cleanliness rating
- Can be referenced in a trail's content section

## Trail Card (Listing Page)

What shows on a trail card in the listing:
- Title, area/location
- Cover image
- Difficulty badge
- Rating
- Length (distance)
- Elevation gain
- Driving time & distance from Bangalore
- Hiking duration
- Highlight tags
