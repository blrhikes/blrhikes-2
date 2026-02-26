import matter from "gray-matter";
import {
  DIFFICULTY_OPTIONS,
  ACCESS_OPTIONS,
  type Difficulty,
  type Access,
} from "@blrhikes/shared";

// --- Configuration ---
const GITHUB_REPO = "shreshthmohan/blrhikes-data";
const CMS_URL = process.env.CMS_URL || "http://localhost:3000";
const CMS_API_KEY = process.env.CMS_API_KEY || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

// --- Types ---
interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  labels: Array<{ name: string }>;
}

interface ParsedTrail {
  title: string;
  slug: string;
  githubIssueNumber: number;
  altName?: string;
  area?: string;
  gps?: string;
  relativeLocation?: string;
  isLocal?: boolean;
  highlights?: string[];
  rating?: number;
  length?: number;
  elevationGain?: number;
  elevation?: number;
  difficulty?: string;
  access?: string;
  drivingDistance?: number;
  drivingDistanceText?: string;
  drivingTime?: number;
  drivingTimeText?: string;
  hikingTime?: number;
  hikingTimeWithRests?: number;
  hikingTimeWithExploration?: number;
  mapLink?: string;
  content?: string;
  coverImageUrl?: string;
  status: "draft" | "live";
}

// --- Helpers ---
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeDifficulty(value: string | undefined): Difficulty | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase().trim() as Difficulty;
  if ((DIFFICULTY_OPTIONS as readonly string[]).includes(lower)) return lower;
  console.warn(`  Unknown difficulty: "${value}"`);
  return undefined;
}

function normalizeAccess(value: string | undefined): Access | undefined {
  if (!value) return "UNMONITORED";
  const upper = value.toUpperCase().trim().replace(/\s+/g, "_") as Access;
  if ((ACCESS_OPTIONS as readonly string[]).includes(upper)) return upper;
  console.warn(`  Unknown access: "${value}"`);
  return "UNMONITORED";
}

function parseNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const num = parseFloat(value.replace(/[^\d.]/g, ""));
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

function extractCoverImageUrl(body: string): string | undefined {
  // Match ![alt](url) pattern - typically the first image in the body
  const match = body.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
  return match?.[1];
}

// --- Fetch issues from GitHub ---
async function fetchIssues(): Promise<GitHubIssue[]> {
  const allIssues: GitHubIssue[] = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/issues?labels=trail,status:live&state=all&per_page=100&page=${page}`;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };
    if (GITHUB_TOKEN) {
      headers.Authorization = `token ${GITHUB_TOKEN}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
    }

    const issues = (await res.json()) as GitHubIssue[];
    if (issues.length === 0) break;

    allIssues.push(...issues);
    page++;
  }

  return allIssues;
}

// --- Parse an issue into trail data ---
function parseIssue(issue: GitHubIssue): ParsedTrail {
  const { data: frontmatter, content } = matter(issue.body || "");

  const coverImageUrl = frontmatter.coverImage
    ? extractCoverImageUrl(`![cover](${frontmatter.coverImage})`)
    : extractCoverImageUrl(issue.body || "");

  return {
    title: frontmatter.title || issue.title,
    slug: slugify(frontmatter.title || issue.title),
    githubIssueNumber: issue.number,
    altName: frontmatter.altName || frontmatter.alt_name,
    area: frontmatter.area || "Unknown",
    gps: frontmatter.gps,
    relativeLocation: frontmatter.relativeLocation || frontmatter.relative_location,
    isLocal: frontmatter.isLocal ?? frontmatter.is_local,
    highlights: Array.isArray(frontmatter.highlights)
      ? frontmatter.highlights.map((h: string) => h.toLowerCase().trim())
      : frontmatter.tags
        ? (Array.isArray(frontmatter.tags)
            ? frontmatter.tags
            : String(frontmatter.tags).split(",")
          ).map((t: string) => t.toLowerCase().trim())
        : undefined,
    rating: parseNumber(frontmatter.rating),
    length: parseNumber(frontmatter.length),
    elevationGain: parseNumber(
      frontmatter.elevationGain ?? frontmatter.elevation_gain
    ),
    elevation: parseNumber(frontmatter.elevation),
    difficulty: normalizeDifficulty(frontmatter.difficulty),
    access: normalizeAccess(frontmatter.access),
    drivingDistance: parseNumber(
      frontmatter.drivingDistance ??
        frontmatter.computedDrivingDistance ??
        frontmatter.driving_distance
    ),
    drivingDistanceText:
      frontmatter.drivingDistanceText ?? frontmatter.driving_distance_text,
    drivingTime: parseNumber(
      frontmatter.drivingTime ??
        frontmatter.computedDrivingTime ??
        frontmatter.driving_time
    ),
    drivingTimeText:
      frontmatter.drivingTimeText ?? frontmatter.driving_time_text,
    hikingTime: parseNumber(
      frontmatter.hikingTime ?? frontmatter.hiking_time
    ),
    hikingTimeWithRests: parseNumber(
      frontmatter.hikingTimeWithRests ?? frontmatter.hiking_time_with_rests
    ),
    hikingTimeWithExploration: parseNumber(
      frontmatter.hikingTimeWithExploration ??
        frontmatter.hiking_time_with_exploration
    ),
    mapLink: frontmatter.mapLink ?? frontmatter.map_link,
    content: content.trim(),
    coverImageUrl,
    status: "live",
  };
}

// --- Upload cover image to CMS ---
async function uploadImage(
  imageUrl: string,
  alt: string
): Promise<string | undefined> {
  try {
    // Fetch the image (GitHub user-attachment URLs may need auth)
    const imgHeaders: Record<string, string> = {};
    if (GITHUB_TOKEN && imageUrl.includes("github.com")) {
      imgHeaders.Authorization = `token ${GITHUB_TOKEN}`;
    }
    const imgRes = await fetch(imageUrl, { headers: imgHeaders });
    if (!imgRes.ok) {
      console.warn(`  Failed to fetch image: ${imageUrl}`);
      return undefined;
    }

    const blob = await imgRes.blob();
    const contentType = blob.type || "image/jpeg";
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const ext = extMap[contentType] || "jpg";
    const filename = `${slugify(alt)}.${ext}`;

    const file = new File([blob], filename, { type: contentType });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("_payload", JSON.stringify({ alt: alt || filename }));

    const res = await fetch(`${CMS_URL}/api/media`, {
      method: "POST",
      headers: {
        ...(CMS_API_KEY ? { Authorization: `users API-Key ${CMS_API_KEY}` } : {}),
      },
      body: formData,
    });

    if (!res.ok) {
      console.warn(`  Failed to upload image: ${res.status}`);
      return undefined;
    }

    const data = (await res.json()) as { doc: { id: string } };
    return data.doc.id;
  } catch (err) {
    console.warn(`  Image upload error: ${err}`);
    return undefined;
  }
}

// --- Caches for area/highlight IDs ---
const areaCache = new Map<string, string>();
const highlightCache = new Map<string, string>();

const authHeaders = (): Record<string, string> =>
  CMS_API_KEY ? { Authorization: `users API-Key ${CMS_API_KEY}` } : {};

async function getOrCreateArea(name: string): Promise<string> {
  if (areaCache.has(name)) return areaCache.get(name)!;

  // Check if it exists
  const checkRes = await fetch(
    `${CMS_URL}/api/areas?where[name][equals]=${encodeURIComponent(name)}&limit=1`,
    { headers: authHeaders() }
  );
  if (checkRes.ok) {
    const data = (await checkRes.json()) as { docs: { id: string }[]; totalDocs: number };
    if (data.totalDocs > 0) {
      areaCache.set(name, data.docs[0].id);
      return data.docs[0].id;
    }
  }

  // Create it
  const res = await fetch(`${CMS_URL}/api/areas`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Failed to create area "${name}": ${res.status}`);
  const doc = (await res.json()) as { doc: { id: string } };
  areaCache.set(name, doc.doc.id);
  return doc.doc.id;
}

async function getOrCreateHighlight(name: string): Promise<string> {
  if (highlightCache.has(name)) return highlightCache.get(name)!;

  const checkRes = await fetch(
    `${CMS_URL}/api/highlights?where[name][equals]=${encodeURIComponent(name)}&limit=1`,
    { headers: authHeaders() }
  );
  if (checkRes.ok) {
    const data = (await checkRes.json()) as { docs: { id: string }[]; totalDocs: number };
    if (data.totalDocs > 0) {
      highlightCache.set(name, data.docs[0].id);
      return data.docs[0].id;
    }
  }

  const res = await fetch(`${CMS_URL}/api/highlights`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Failed to create highlight "${name}": ${res.status}`);
  const doc = (await res.json()) as { doc: { id: string } };
  highlightCache.set(name, doc.doc.id);
  return doc.doc.id;
}

// --- Create trail in CMS ---
async function createTrail(
  trail: ParsedTrail,
  coverImageId?: string
): Promise<void> {
  // Resolve area → ID
  const areaId = trail.area ? await getOrCreateArea(trail.area) : undefined;

  // Resolve highlights → IDs
  const highlightIds = trail.highlights
    ? await Promise.all(trail.highlights.map((h) => getOrCreateHighlight(h)))
    : undefined;

  const body: Record<string, unknown> = {
    title: trail.title,
    slug: trail.slug,
    githubIssueNumber: trail.githubIssueNumber,
    altName: trail.altName,
    area: areaId,
    gps: trail.gps,
    relativeLocation: trail.relativeLocation,
    isLocal: trail.isLocal,
    highlights: highlightIds,
    rating: trail.rating,
    length: trail.length,
    elevationGain: trail.elevationGain,
    elevation: trail.elevation,
    difficulty: trail.difficulty,
    access: trail.access,
    drivingDistance: trail.drivingDistance,
    drivingDistanceText: trail.drivingDistanceText,
    drivingTime: trail.drivingTime,
    drivingTimeText: trail.drivingTimeText,
    hikingTime: trail.hikingTime,
    hikingTimeWithRests: trail.hikingTimeWithRests,
    hikingTimeWithExploration: trail.hikingTimeWithExploration,
    mapLink: trail.mapLink,
    content: trail.content,
    status: trail.status,
  };

  if (coverImageId) {
    body.coverImage = coverImageId;
  }

  // Remove undefined values
  for (const key of Object.keys(body)) {
    if (body[key] === undefined) delete body[key];
  }

  const res = await fetch(`${CMS_URL}/api/trails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(CMS_API_KEY ? { Authorization: `users API-Key ${CMS_API_KEY}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create trail "${trail.title}": ${res.status} ${text}`);
  }
}

// --- Main ---
async function main() {
  console.log(`CMS_URL: ${CMS_URL}`);
  console.log(`CMS_API_KEY: ${CMS_API_KEY ? CMS_API_KEY.slice(0, 8) + "..." : "(not set)"}`);
  console.log(`GITHUB_TOKEN: ${GITHUB_TOKEN ? GITHUB_TOKEN.slice(0, 8) + "..." : "(not set)"}`);
  console.log("Fetching issues from GitHub...");
  const issues = await fetchIssues();
  console.log(`Found ${issues.length} trail issues`);

  let success = 0;
  let failed = 0;

  for (const issue of issues) {
    console.log(`\nProcessing: ${issue.title} (#${issue.number})`);
    try {
      // Check if trail already exists
      const checkRes = await fetch(
        `${CMS_URL}/api/trails?where[githubIssueNumber][equals]=${issue.number}&limit=1`,
        {
          headers: CMS_API_KEY ? { Authorization: `users API-Key ${CMS_API_KEY}` } : {},
        }
      );
      if (checkRes.ok) {
        const existing = (await checkRes.json()) as { totalDocs: number };
        if (existing.totalDocs > 0) {
          console.log(`  Skipped (already exists)`);
          success++;
          continue;
        }
      }

      const trail = parseIssue(issue);

      let coverImageId: string | undefined;
      if (trail.coverImageUrl) {
        console.log(`  Uploading cover image...`);
        coverImageId = await uploadImage(trail.coverImageUrl, trail.title);
      }

      console.log(`  Creating trail in CMS...`);
      await createTrail(trail, coverImageId);
      console.log(`  Done.`);
      success++;
    } catch (err) {
      console.error(`  ERROR: ${err}`);
      failed++;
    }
  }

  console.log(`\nMigration complete: ${success} succeeded, ${failed} failed`);
}

main().catch(console.error);
