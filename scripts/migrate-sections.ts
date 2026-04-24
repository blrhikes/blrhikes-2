import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------
const COMMIT = process.argv.includes("--commit");
const REFRESH = process.argv.includes("--refresh");
const trailFlagIdx = process.argv.indexOf("--trail");
const ONLY_TRAIL =
  trailFlagIdx >= 0 ? process.argv[trailFlagIdx + 1] : undefined;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CMS_URL = process.env.CMS_URL || "http://localhost:3000";
const CMS_API_KEY = process.env.CMS_API_KEY || "";
const GITHUB_REPO = "shreshthmohan/blrhikes-data";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const CDN_BASE =
  "https://blrhikes.com/cdn-cgi/image/width=800,quality=80,format=jpeg/https://images.blrhikes.com";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, ".cache");
const CACHE_FILE = join(CACHE_DIR, "github-data.json");

// ---------------------------------------------------------------------------
// Types (mirror the shapes we care about — don't pull Payload types here to
// keep the script standalone)
// ---------------------------------------------------------------------------
interface GitHubIssue {
  number: number;
  title: string;
  body: string;
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

type SectionVisibility = "public" | "members";

interface PortedSection {
  heading: string;
  slug: string;
  visibility: SectionVisibility;
  published: boolean;
  body: string;
  sourceRef: string;
  // `attachments` intentionally omitted from the port. Editors curate
  // downloadable files (GPX, PDFs) via the admin UI in Phase A.
}

interface Trail {
  id: number;
  slug: string;
  githubIssueNumber?: number;
  sections?: (PortedSection & { id?: string })[];
}

// ---------------------------------------------------------------------------
// Helpers — slugify must match the Payload beforeValidate hook so both sides
// agree on collision-resolved slugs.
// ---------------------------------------------------------------------------
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function dedupeSlugs<T extends { slug: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.map((item) => {
    const base = item.slug || "section";
    let candidate = base;
    let i = 2;
    while (seen.has(candidate)) {
      candidate = `${base}-${i}`;
      i++;
    }
    seen.add(candidate);
    return { ...item, slug: candidate };
  });
}

function rewriteGitHubImageUrls(markdown: string): string {
  return markdown.replace(
    /https:\/\/github\.com\/user-attachments\/assets\/([a-f0-9-]+)/g,
    `${CDN_BASE}/$1`,
  );
}

// ---------------------------------------------------------------------------
// Section derivation
// ---------------------------------------------------------------------------

// Split the issue body into H2-delimited sections. Text before the first H2
// becomes an "Overview" section (only if there is body text and at least one H2
// follows — otherwise a single-H2-less body becomes the sole Overview).
function splitBodyIntoSections(
  body: string,
): { heading: string; content: string; sourceRef: string }[] {
  const { content: stripped } = matter(body || "");
  const trimmed = stripped.trim();
  if (!trimmed) return [];

  // Match `## Heading\n` — greedy up to the next `## ` or EOF.
  const h2Regex = /^##\s+(.+?)\s*$/gm;
  const out: { heading: string; content: string; sourceRef: string }[] = [];

  const matches = [...trimmed.matchAll(h2Regex)];

  if (matches.length === 0) {
    // Whole body is one Overview section.
    return [
      { heading: "Overview", content: trimmed, sourceRef: "body-preamble" },
    ];
  }

  // Preamble before first H2
  const preamble = trimmed.slice(0, matches[0].index).trim();
  if (preamble) {
    out.push({
      heading: "Overview",
      content: preamble,
      sourceRef: "body-preamble",
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const heading = m[1].trim();
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : trimmed.length;
    const content = trimmed.slice(start, end).trim();
    out.push({
      heading,
      content,
      sourceRef: `body-h2-${i}`,
    });
  }
  return out;
}

function parseCommentSections(
  comments: GitHubComment[],
): { heading: string; content: string; sourceRef: string }[] {
  const out: { heading: string; content: string; sourceRef: string }[] = [];
  for (const comment of comments) {
    const { data: fm, content } = matter(comment.body || "");
    if (!fm.section || fm.status !== "live") continue;
    out.push({
      heading: String(fm.section),
      content: content.trim(),
      sourceRef: `comment-${comment.id}`,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// GitHub fetch (only runs with --refresh or when no cache exists)
// ---------------------------------------------------------------------------
function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (GITHUB_TOKEN) headers.Authorization = `token ${GITHUB_TOKEN}`;
  return headers;
}

async function fetchIssues(): Promise<GitHubIssue[]> {
  const all: GitHubIssue[] = [];
  let page = 1;
  while (true) {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/issues?labels=trail,status:live&state=all&per_page=100&page=${page}`;
    const res = await fetch(url, { headers: githubHeaders() });
    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
    }
    const issues = (await res.json()) as GitHubIssue[];
    if (issues.length === 0) break;
    all.push(...issues);
    page++;
  }
  return all;
}

async function fetchIssueComments(issueNumber: number): Promise<GitHubComment[]> {
  const all: GitHubComment[] = [];
  let page = 1;
  while (true) {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/issues/${issueNumber}/comments?per_page=100&page=${page}`;
    const res = await fetch(url, { headers: githubHeaders() });
    if (!res.ok) {
      console.warn(
        `  [#${issueNumber}] failed to fetch comments: ${res.status}`,
      );
      break;
    }
    const comments = (await res.json()) as GitHubComment[];
    if (comments.length === 0) break;
    all.push(...comments);
    page++;
  }
  return all;
}

async function refreshGitHubCache(): Promise<CachedGitHubData> {
  console.log(`Refreshing GitHub cache from ${GITHUB_REPO}…`);
  const issues = await fetchIssues();
  console.log(`  fetched ${issues.length} issues`);
  const comments: Record<number, GitHubComment[]> = {};
  for (const issue of issues) {
    const list = await fetchIssueComments(issue.number);
    comments[issue.number] = list;
    if (list.length > 0) {
      console.log(`  #${issue.number}: ${list.length} comment(s)`);
    }
  }
  const data: CachedGitHubData = {
    fetchedAt: new Date().toISOString(),
    issues,
    comments,
  };
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  console.log(`  wrote ${CACHE_FILE}`);
  return data;
}

async function loadGitHubCache(): Promise<CachedGitHubData> {
  if (REFRESH || !existsSync(CACHE_FILE)) {
    if (!REFRESH) {
      console.log(`No cache at ${CACHE_FILE} — doing a fresh fetch.`);
    }
    return refreshGitHubCache();
  }
  const data = JSON.parse(readFileSync(CACHE_FILE, "utf-8")) as CachedGitHubData;
  console.log(
    `Loaded cached GitHub data from ${data.fetchedAt} (${data.issues.length} issues). Use --refresh to re-fetch.`,
  );
  return data;
}

// ---------------------------------------------------------------------------
// CMS client
// ---------------------------------------------------------------------------
const authHeaders = (): Record<string, string> =>
  CMS_API_KEY ? { Authorization: `users API-Key ${CMS_API_KEY}` } : {};

async function findTrailByIssueNumber(
  issueNumber: number,
): Promise<Trail | null> {
  const qs = new URLSearchParams();
  qs.set("where[githubIssueNumber][equals]", String(issueNumber));
  qs.set("limit", "1");
  qs.set("depth", "0");
  const res = await fetch(`${CMS_URL}/api/trails?${qs.toString()}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { docs: Trail[]; totalDocs: number };
  return data.docs[0] || null;
}

async function patchTrailSections(
  trailId: number,
  sections: PortedSection[],
): Promise<void> {
  const res = await fetch(`${CMS_URL}/api/trails/${trailId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ sections }),
  });
  if (!res.ok) {
    throw new Error(
      `Failed to PATCH trail ${trailId}: ${res.status} ${await res.text()}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Per-trail porting
// ---------------------------------------------------------------------------
function buildSectionsForTrail(
  issue: GitHubIssue,
  comments: GitHubComment[],
): PortedSection[] {
  const body = splitBodyIntoSections(issue.body || "").map((s) => ({
    ...s,
    visibility: "public" as SectionVisibility,
  }));
  const commentSections = parseCommentSections(comments).map((s) => ({
    ...s,
    visibility: "members" as SectionVisibility,
  }));

  const raw = [...body, ...commentSections];

  // Materialize each into a PortedSection with cleaned body.
  // GPX/PDF links are left inline in the body — editors promote to
  // section.attachments manually in the admin UI.
  const materialized: PortedSection[] = raw.map((s) => ({
    heading: s.heading,
    slug: slugify(s.heading) || "section",
    visibility: s.visibility,
    published: true,
    body: rewriteGitHubImageUrls(s.content),
    sourceRef: s.sourceRef,
  }));

  return dedupeSlugs(materialized);
}

// Merge port-derived sections into existing trail sections:
//   - Replace / insert by sourceRef
//   - Delete sections whose sourceRef looks port-managed (startsWith body- or
//     comment-) but is no longer in the new set
//   - Leave editor-authored sections (no sourceRef) untouched, preserving order
function mergeSections(
  existing: (PortedSection & { id?: string })[] | undefined,
  incoming: PortedSection[],
): PortedSection[] {
  const current = existing ?? [];
  const incomingByRef = new Map(incoming.map((s) => [s.sourceRef, s]));

  // Start with all existing non-port-managed rows, preserving order.
  const merged: PortedSection[] = [];
  const handledRefs = new Set<string>();

  for (const row of current) {
    const ref = row.sourceRef ?? "";
    const isPortManaged =
      ref.startsWith("body-") || ref.startsWith("comment-");
    if (!isPortManaged) {
      merged.push(row);
      continue;
    }
    // Port-managed row — replace with incoming if present, otherwise drop (stale).
    const updated = incomingByRef.get(ref);
    if (updated) {
      merged.push(updated);
      handledRefs.add(ref);
    }
  }

  // Append any incoming refs that weren't replacing an existing row.
  for (const s of incoming) {
    if (!handledRefs.has(s.sourceRef)) merged.push(s);
  }

  return dedupeSlugs(merged);
}

// ---------------------------------------------------------------------------
// Dry-run diff printer
// ---------------------------------------------------------------------------
function diffSections(
  before: (PortedSection & { id?: string })[] | undefined,
  after: PortedSection[],
): { create: number; update: number; keep: number; delete: number } {
  const b = before ?? [];
  const bySourceRef = new Map(b.map((s) => [s.sourceRef, s]));
  const afterRefs = new Set(after.map((s) => s.sourceRef));
  let create = 0,
    update = 0,
    keep = 0,
    del = 0;
  for (const s of after) {
    const prev = bySourceRef.get(s.sourceRef);
    if (!prev) create++;
    else if (JSON.stringify({ ...prev, id: undefined }) !== JSON.stringify(s)) update++;
    else keep++;
  }
  for (const s of b) {
    const portManaged =
      s.sourceRef?.startsWith("body-") || s.sourceRef?.startsWith("comment-");
    if (portManaged && !afterRefs.has(s.sourceRef)) del++;
  }
  return { create, update, keep, delete: del };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`CMS_URL:     ${CMS_URL}`);
  console.log(`CMS_API_KEY: ${CMS_API_KEY ? CMS_API_KEY.slice(0, 8) + "..." : "(not set)"}`);
  console.log(`Mode:        ${COMMIT ? "COMMIT (writes enabled)" : "DRY RUN (no writes)"}`);
  if (ONLY_TRAIL) console.log(`Trail:       ${ONLY_TRAIL} (single-trail mode)`);

  // Load / refresh the GitHub cache first.
  const cached = await loadGitHubCache();

  // `--refresh` is refresh-only. To run the port too, re-invoke without
  // `--refresh` (with or without `--commit`). Keeps the two phases explicit
  // and avoids surprising CMS writes when the user just wanted a cache pull.
  if (REFRESH) {
    console.log(`\nCache refreshed. Run again without --refresh to port into the CMS.`);
    return;
  }

  if (!CMS_API_KEY) {
    throw new Error(
      "CMS_API_KEY must be set for CMS port operations (see docs/content-sections-runbook.md §3)",
    );
  }

  let processed = 0;
  let totals = { create: 0, update: 0, keep: 0, delete: 0 };

  for (const issue of cached.issues) {
    const trail = await findTrailByIssueNumber(issue.number);
    if (!trail) {
      console.warn(`  [${issue.number}] no trail found in CMS — skipped. Run migrate.ts first.`);
      continue;
    }
    if (ONLY_TRAIL && trail.slug !== ONLY_TRAIL) continue;

    const incoming = buildSectionsForTrail(
      issue,
      cached.comments[issue.number] || [],
    );
    const merged = mergeSections(trail.sections, incoming);
    const d = diffSections(trail.sections, merged);
    totals.create += d.create;
    totals.update += d.update;
    totals.keep += d.keep;
    totals.delete += d.delete;

    console.log(
      `  [${issue.number}] ${trail.slug}: +${d.create} ~${d.update} =${d.keep} -${d.delete}`,
    );

    if (COMMIT) {
      await patchTrailSections(trail.id, merged);
    }
    processed++;
  }

  console.log(
    `\nDone. Trails processed: ${processed}. Sections: +${totals.create} ~${totals.update} =${totals.keep} -${totals.delete}`,
  );
  if (!COMMIT) {
    console.log(`(dry run — pass --commit to write)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
