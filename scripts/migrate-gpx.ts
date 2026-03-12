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

// --- Find trail by slug ---
async function findTrailBySlug(
  slug: string
): Promise<{ id: string; title: string; gpxFile?: unknown } | undefined> {
  const res = await fetch(
    `${CMS_URL}/api/trails?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
    { headers: authHeaders() }
  );
  if (!res.ok) return undefined;

  const data = (await res.json()) as {
    docs: { id: string; title: string; gpxFile?: unknown }[];
    totalDocs: number;
  };
  return data.totalDocs > 0 ? data.docs[0] : undefined;
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
    const trail = await findTrailBySlug(slug);

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
