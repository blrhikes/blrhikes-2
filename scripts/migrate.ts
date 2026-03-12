import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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
const CMS_EMAIL = process.env.CMS_EMAIL || "";
const CMS_PASSWORD = process.env.CMS_PASSWORD || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

let CMS_TOKEN = "";

async function loginToCMS(): Promise<void> {
  const res = await fetch(`${CMS_URL}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: CMS_EMAIL, password: CMS_PASSWORD }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CMS login failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { token: string };
  CMS_TOKEN = data.token;
  console.log("Logged in to CMS successfully.");
}
const FORCE = process.argv.includes("--force");
const REFRESH = process.argv.includes("--refresh");

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, ".cache");
const CACHE_FILE = join(CACHE_DIR, "github-data.json");

const CDN_BASE =
  "https://blrhikes.com/cdn-cgi/image/width=800,quality=80,format=jpeg/https://images.blrhikes.com";

// --- Types ---
interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  labels: Array<{ name: string }>;
}

interface GitHubComment {
  id: number;
  body: string;
}

interface CachedGitHubData {
  fetchedAt: string;
  issues: GitHubIssue[];
  comments: Record<number, GitHubComment[]>;
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

// --- URL Rewriting ---
function rewriteGitHubImageUrls(markdown: string): string {
  return markdown.replace(
    /https:\/\/github\.com\/user-attachments\/assets\/([a-f0-9-]+)/g,
    `${CDN_BASE}/$1`,
  );
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
  if (!match?.[1]) return undefined;
  return rewriteGitHubImageUrls(match[1]);
}

// --- Fetch issues from GitHub ---
function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (GITHUB_TOKEN) {
    headers.Authorization = `token ${GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchIssues(): Promise<GitHubIssue[]> {
  const allIssues: GitHubIssue[] = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/issues?labels=trail,status:live&state=all&per_page=100&page=${page}`;

    const res = await fetch(url, { headers: githubHeaders() });
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

// --- Fetch issue comments ---
async function fetchIssueComments(issueNumber: number): Promise<GitHubComment[]> {
  const allComments: GitHubComment[] = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/issues/${issueNumber}/comments?per_page=100&page=${page}`;

    const res = await fetch(url, { headers: githubHeaders() });
    if (!res.ok) {
      console.warn(`  Failed to fetch comments for issue #${issueNumber}: ${res.status}`);
      break;
    }

    const comments = (await res.json()) as GitHubComment[];
    if (comments.length === 0) break;

    allComments.push(...comments);
    page++;
  }

  return allComments;
}

// --- Parse live sections from comments ---
function parseLiveSections(comments: GitHubComment[]): string {
  const sections: string[] = [];

  for (const comment of comments) {
    const { data: frontmatter, content } = matter(comment.body || "");
    if (frontmatter.section && frontmatter.status === "live") {
      const rewrittenContent = rewriteGitHubImageUrls(content.trim());
      sections.push(`## ${frontmatter.section}\n\n${rewrittenContent}`);
    }
  }

  return sections.join("\n\n");
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
      frontmatter.elevationGain ?? frontmatter.elevation_gain,
    ),
    elevation: parseNumber(frontmatter.elevation),
    difficulty: normalizeDifficulty(frontmatter.difficulty),
    access: normalizeAccess(frontmatter.access),
    drivingDistance: parseNumber(
      frontmatter.drivingDistance ??
        frontmatter.computedDrivingDistance ??
        frontmatter.driving_distance,
    ),
    drivingDistanceText:
      frontmatter.drivingDistanceText ?? frontmatter.driving_distance_text,
    drivingTime: parseNumber(
      frontmatter.drivingTime ??
        frontmatter.computedDrivingTime ??
        frontmatter.driving_time,
    ),
    drivingTimeText:
      frontmatter.drivingTimeText ?? frontmatter.driving_time_text,
    hikingTime: parseNumber(
      frontmatter.hikingTime ?? frontmatter.hiking_time,
    ),
    hikingTimeWithRests: parseNumber(
      frontmatter.hikingTimeWithRests ?? frontmatter.hiking_time_with_rests,
    ),
    hikingTimeWithExploration: parseNumber(
      frontmatter.hikingTimeWithExploration ??
        frontmatter.hiking_time_with_exploration,
    ),
    mapLink: frontmatter.mapLink ?? frontmatter.map_link,
    content: rewriteGitHubImageUrls(content.trim()),
    coverImageUrl,
    status: "live",
  };
}

// --- Caches for area/highlight IDs ---
const areaCache = new Map<string, string>();
const highlightCache = new Map<string, string>();

const authHeaders = (): Record<string, string> =>
  CMS_TOKEN ? { Authorization: `Bearer ${CMS_TOKEN}` } : {};

async function getOrCreateArea(name: string): Promise<string> {
  if (areaCache.has(name)) return areaCache.get(name)!;

  // Check if it exists
  const checkRes = await fetch(
    `${CMS_URL}/api/areas?where[name][equals]=${encodeURIComponent(name)}&limit=1`,
    { headers: authHeaders() },
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
    { headers: authHeaders() },
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

// --- Create or update trail in CMS ---
async function upsertTrail(trail: ParsedTrail, existingId?: string): Promise<void> {
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
    coverImage: trail.coverImageUrl
      ? { type: 'url', url: trail.coverImageUrl }
      : undefined,
    status: trail.status,
  };

  // Remove undefined values
  for (const key of Object.keys(body)) {
    if (body[key] === undefined) delete body[key];
  }

  const method = existingId ? "PATCH" : "POST";
  const url = existingId
    ? `${CMS_URL}/api/trails/${existingId}`
    : `${CMS_URL}/api/trails`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to ${method} trail "${trail.title}": ${res.status} ${text}`);
  }
}

// --- Local GitHub data cache ---
function readCache(): CachedGitHubData | null {
  if (!existsSync(CACHE_FILE)) return null;
  try {
    const raw = readFileSync(CACHE_FILE, "utf-8");
    return JSON.parse(raw) as CachedGitHubData;
  } catch {
    return null;
  }
}

function writeCache(data: CachedGitHubData): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
}

async function loadOrFetchGitHubData(): Promise<CachedGitHubData> {
  if (!REFRESH) {
    const cached = readCache();
    if (cached) {
      console.log(`Using cached GitHub data from ${cached.fetchedAt}`);
      console.log(`  ${cached.issues.length} issues, ${Object.keys(cached.comments).length} comment threads`);
      console.log(`  (use --refresh to re-fetch from GitHub)`);
      return cached;
    }
  }

  console.log("Fetching issues from GitHub...");
  const issues = await fetchIssues();
  console.log(`Found ${issues.length} trail issues`);

  console.log("Fetching comments for each issue...");
  const comments: Record<number, GitHubComment[]> = {};
  for (const issue of issues) {
    const issueComments = await fetchIssueComments(issue.number);
    comments[issue.number] = issueComments;
    if (issueComments.length > 0) {
      console.log(`  #${issue.number}: ${issueComments.length} comment(s)`);
    }
  }

  const data: CachedGitHubData = {
    fetchedAt: new Date().toISOString(),
    issues,
    comments,
  };

  writeCache(data);
  console.log(`Cached GitHub data to ${CACHE_FILE}`);
  return data;
}

// --- Main ---
async function main() {
  console.log(`CMS_URL: ${CMS_URL}`);
  console.log(`CMS_EMAIL: ${CMS_EMAIL || "(not set)"}`);
  console.log(`GITHUB_TOKEN: ${GITHUB_TOKEN ? GITHUB_TOKEN.slice(0, 8) + "..." : "(not set)"}`);
  console.log(`Force mode: ${FORCE ? "ON" : "OFF"}`);
  await loginToCMS();

  const githubData = await loadOrFetchGitHubData();

  let success = 0;
  let failed = 0;

  for (const issue of githubData.issues) {
    console.log(`\nProcessing: ${issue.title} (#${issue.number})`);
    try {
      // Check if trail already exists
      const checkRes = await fetch(
        `${CMS_URL}/api/trails?where[githubIssueNumber][equals]=${issue.number}&limit=1`,
        {
          headers: authHeaders(),
        },
      );
      let existingId: string | undefined;
      if (checkRes.ok) {
        const existing = (await checkRes.json()) as { totalDocs: number; docs: { id: string }[] };
        if (existing.totalDocs > 0) {
          if (!FORCE) {
            console.log(`  Skipped (already exists, use --force to update)`);
            success++;
            continue;
          }
          existingId = existing.docs[0].id;
          console.log(`  Updating existing trail (--force)...`);
        }
      }

      const trail = parseIssue(issue);

      // Append live sections from cached comments
      const comments = githubData.comments[issue.number] || [];
      const liveSections = parseLiveSections(comments);
      if (liveSections) {
        trail.content = trail.content
          ? `${trail.content}\n\n${liveSections}`
          : liveSections;
        console.log(`  Appended live sections from ${comments.length} comment(s)`);
      }

      console.log(`  ${existingId ? "Updating" : "Creating"} trail in CMS...`);
      await upsertTrail(trail, existingId);
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
