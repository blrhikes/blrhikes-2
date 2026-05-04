import fs from "fs";
import path from "path";

// --- Configuration ---
const CMS_URL = process.env.CMS_URL || "http://localhost:3000";
const CMS_API_KEY = process.env.CMS_API_KEY || "";
const GPX_DIR = path.resolve(import.meta.dirname, "../../blrhikes/public/gpx");

const authHeaders = (): Record<string, string> =>
  CMS_API_KEY ? { Authorization: `users API-Key ${CMS_API_KEY}` } : {};

// Match the old blrhikes repo's slugify: trim dashes that the old version left in
function gpxFilenameToSlug(filename: string): string {
  return filename
    .replace(/\.gpx$/, "")
    .replace(/(^-|-$)/g, "");
}

// Mirrors apps/cms/src/collections/Trails.ts slugify so a title can be
// converted to the same shape that gpx filenames already use.
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

// Fetch every trail (paginating) and build a map from slugified title → trail.
async function buildTitleSlugMap(): Promise<
  Map<string, { id: string; title: string; gpxFile?: unknown }>
> {
  const map = new Map<string, { id: string; title: string; gpxFile?: unknown }>();
  const limit = 100;
  let page = 1;
  while (true) {
    const res = await fetch(
      `${CMS_URL}/api/trails?limit=${limit}&page=${page}&depth=0`,
      { headers: authHeaders() },
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch trails: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as {
      docs: { id: string; title: string; gpxFile?: unknown }[];
      totalPages: number;
    };
    for (const t of data.docs) {
      const key = slugify(t.title || "");
      if (!key) continue;
      // First-write wins on collisions; warn so the operator can disambiguate.
      if (map.has(key)) {
        console.warn(`  Duplicate title-slug "${key}" → ids ${map.get(key)!.id} & ${t.id}`);
        continue;
      }
      map.set(key, t);
    }
    if (page >= data.totalPages) break;
    page++;
  }
  return map;
}

// --- Upload GPX file to CMS ---
async function uploadGpx(filePath: string): Promise<string | undefined> {
  const fileBuffer = fs.readFileSync(filePath);
  const filename = path.basename(filePath);
  const blob = new Blob([fileBuffer], { type: "application/gpx+xml" });
  const file = new File([blob], filename, { type: "application/gpx+xml" });

  const formData = new FormData();
  formData.append("file", file);
  formData.append("_payload", JSON.stringify({}));

  const res = await fetch(`${CMS_URL}/api/gpx-files`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn(`  Failed to upload GPX: ${res.status} ${text}`);
    return undefined;
  }

  const data = (await res.json()) as { doc: { id: string } };
  return data.doc.id;
}

// --- Patch trail with GPX file ID ---
async function patchTrailGpx(
  trailId: string,
  gpxFileId: string
): Promise<boolean> {
  const res = await fetch(`${CMS_URL}/api/trails/${trailId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ gpxFile: gpxFileId }),
  });
  return res.ok;
}

// --- Main ---
async function main() {
  console.log(`CMS_URL: ${CMS_URL}`);
  console.log(`GPX_DIR: ${GPX_DIR}`);
  console.log(`CMS_API_KEY: ${CMS_API_KEY ? CMS_API_KEY.slice(0, 8) + "..." : "(not set)"}`);

  if (!fs.existsSync(GPX_DIR)) {
    console.error(`GPX directory not found: ${GPX_DIR}`);
    process.exit(1);
  }

  const gpxFiles = fs
    .readdirSync(GPX_DIR)
    .filter((f) => f.endsWith(".gpx"))
    .sort();

  console.log(`Found ${gpxFiles.length} GPX files\n`);

  console.log(`Building title-slug → trail map…`);
  const titleSlugMap = await buildTitleSlugMap();
  console.log(`Indexed ${titleSlugMap.size} trails by title-slug\n`);

  let matched = 0;
  let skipped = 0;
  let uploaded = 0;
  let uploadedUnmatched = 0;
  let noMatch = 0;
  const unmatched: string[] = [];

  for (const gpxFile of gpxFiles) {
    const slug = gpxFilenameToSlug(gpxFile);
    console.log(`${gpxFile} → slug: "${slug}"`);

    const gpxPath = path.join(GPX_DIR, gpxFile);
    const trail = titleSlugMap.get(slug);

    if (!trail) {
      console.log(`  No matching trail — uploading to GPX collection only`);
      const gpxId = await uploadGpx(gpxPath);
      if (gpxId) {
        console.log(`  Uploaded (id: ${gpxId})`);
        uploadedUnmatched++;
      } else {
        console.log(`  Upload failed`);
      }
      unmatched.push(gpxFile);
      noMatch++;
      continue;
    }

    matched++;
    console.log(`  Matched: "${trail.title}" (id: ${trail.id})`);

    if (trail.gpxFile) {
      console.log(`  Skipped (already has GPX file)`);
      skipped++;
      continue;
    }

    const gpxId = await uploadGpx(gpxPath);
    if (!gpxId) {
      console.log(`  Upload failed`);
      continue;
    }

    const ok = await patchTrailGpx(trail.id, gpxId);
    if (ok) {
      console.log(`  Uploaded and linked`);
      uploaded++;
    } else {
      console.log(`  Failed to link GPX to trail`);
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total GPX files: ${gpxFiles.length}`);
  console.log(`Matched to trails: ${matched}`);
  console.log(`Uploaded & linked to trail: ${uploaded}`);
  console.log(`Skipped (already set): ${skipped}`);
  console.log(`No matching trail: ${noMatch} (${uploadedUnmatched} uploaded to collection)`);

  if (unmatched.length > 0) {
    console.log(`\nUnmatched GPX files (uploaded but not linked to a trail):`);
    unmatched.forEach((f) => console.log(`  - ${f}`));
  }
}

main().catch(console.error);
