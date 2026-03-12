import { Link } from "react-router";
import matter from "gray-matter";
import type { Route } from "./+types/design";
import { TrailCard } from "../components/trail-card";
import githubData from "../../../../scripts/.cache/github-data.json";

const CDN_BASE =
  "https://blrhikes.com/cdn-cgi/image/width=800,quality=80,format=jpeg/https://images.blrhikes.com";

function rewriteGitHubImageUrls(markdown: string): string {
  return markdown.replace(
    /https:\/\/github\.com\/user-attachments\/assets\/([a-f0-9-]+)/g,
    `${CDN_BASE}/$1`,
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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
  const match = body.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
  if (!match?.[1]) return undefined;
  return rewriteGitHubImageUrls(match[1]);
}

function parseIssue(issue: { number: number; title: string; body: string }) {
  const { data: fm } = matter(issue.body || "");

  const coverImageUrl = fm.coverImage
    ? extractCoverImageUrl(`![cover](${fm.coverImage})`)
    : extractCoverImageUrl(issue.body || "");

  return {
    id: String(issue.number),
    slug: slugify(fm.title || issue.title),
    title: fm.title || issue.title,
    altName: fm.altName || fm.alt_name,
    area: fm.area || "Unknown",
    highlights: Array.isArray(fm.highlights)
      ? fm.highlights.map((h: string) => h.toLowerCase().trim())
      : undefined,
    rating: parseNumber(fm.rating),
    length: parseNumber(fm.length),
    elevationGain: parseNumber(fm.elevationGain ?? fm.elevation_gain),
    elevation: parseNumber(fm.elevation),
    difficulty: fm.difficulty?.toLowerCase().trim(),
    access: fm.access,
    drivingDistanceText:
      fm.drivingDistanceText ?? fm.computedDrivingDistanceText ?? fm.driving_distance_text,
    hikingTime: (() => {
      const hrs = parseNumber(fm.computedRoundedHikingTime ?? fm.hikingTime ?? fm.hiking_time);
      return hrs != null ? Math.round(hrs * 60) : undefined;
    })(),
    coverImageUrl,
  };
}

export async function loader() {
  const trails = githubData.issues.map(parseIssue);
  return { trails };
}

function formatMinutes(minutes: number | undefined): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const difficultyBadge: Record<string, string> = {
  easy: "bg-stone-200 text-stone-700",
  "easy-moderate": "bg-stone-200 text-stone-700",
  moderate: "bg-stone-200 text-stone-700",
  "moderate-hard": "bg-stone-200 text-stone-700",
  hard: "bg-stone-200 text-stone-700",
};

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const cls = difficultyBadge[difficulty] || "bg-stone-200 text-stone-700";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${cls}`}>
      {difficulty}
    </span>
  );
}

function TrailTable({ trails }: { trails: any[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border-2 border-stone-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-stone-100 text-xs uppercase tracking-wider text-stone-500">
            <th className="text-left px-4 py-3 border-b border-stone-200">Trail</th>
            <th className="text-left px-4 py-3 border-b border-stone-200">Area</th>
            <th className="text-left px-4 py-3 border-b border-stone-200">Difficulty</th>
            <th className="text-left px-4 py-3 border-b border-stone-200">Distance</th>
            <th className="text-left px-4 py-3 border-b border-stone-200">Elevation</th>
            <th className="text-left px-4 py-3 border-b border-stone-200">Time</th>
            <th className="text-left px-4 py-3 border-b border-stone-200">Drive</th>
            <th className="text-left px-4 py-3 border-b border-stone-200">Rating</th>
            <th className="text-left px-4 py-3 border-b border-stone-200">Tags</th>
          </tr>
        </thead>
        <tbody>
          {trails.map((trail: any) => (
            <tr key={trail.id} className="border-b border-stone-200 hover:bg-accent/5 transition">
              <td className="px-4 py-3">
                <span className="font-bold font-serif">{trail.title}</span>
              </td>
              <td className="px-4 py-3 text-stone-500">{trail.area || "—"}</td>
              <td className="px-4 py-3">{trail.difficulty && <DifficultyBadge difficulty={trail.difficulty} />}</td>
              <td className="px-4 py-3">{trail.length != null ? `${trail.length} km` : "—"}</td>
              <td className="px-4 py-3">{trail.elevationGain != null ? `${trail.elevationGain}m` : "—"}</td>
              <td className="px-4 py-3">{formatMinutes(trail.hikingTime)}</td>
              <td className="px-4 py-3">{trail.drivingDistanceText || "—"}</td>
              <td className="px-4 py-3 text-accent font-semibold">
                {trail.rating != null ? `★ ${trail.rating}` : "—"}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {trail.highlights?.slice(0, 3).map((h: string) => (
                    <span key={h} className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs">
                      {h}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DesignPage({ loaderData }: Route.ComponentProps) {
  const { trails } = loaderData;

  return (
    <div className="min-h-screen bg-stone-50">
      <nav className="border-b border-stone-200">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between h-16">
          <Link to="/design" className="text-2xl font-bold tracking-tight text-stone-900">
            Design System
          </Link>
          <Link to="/trails" className="text-sm text-stone-500 hover:text-stone-900 transition">
            ← Back to Trails
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-12">
        <p className="text-stone-500">
          Showing {trails.length} trails from GitHub data
        </p>

        {/* List View */}
        <section>
          <h2 className="text-2xl font-bold mb-1">List View</h2>
          <p className="text-stone-500 mb-6">TrailCard with mode="list"</p>
          <div className="space-y-3">
            {trails.map((trail: any) => (
              <TrailCard key={trail.id} trail={trail} mode="list" />
            ))}
          </div>
        </section>

        {/* Table View */}
        <section>
          <h2 className="text-2xl font-bold mb-1">Table View</h2>
          <p className="text-stone-500 mb-6">TrailTable component</p>
          <TrailTable trails={trails} />
        </section>
      </main>
    </div>
  );
}
