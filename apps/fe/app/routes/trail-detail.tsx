import { Link, data } from "react-router";
import type { Route } from "./+types/trail-detail";
import { fetchTrailBySlug } from "../lib/api.server";
import Markdown from "react-markdown";

export function meta({ data: trail }: Route.MetaArgs) {
  if (!trail) {
    return [{ title: "Trail Not Found | BLR Hikes" }];
  }
  const title = `${trail.title} | BLR Hikes`;
  const description = trail.area
    ? `Hiking trail in ${trail.area} near Bangalore`
    : "Hiking trail near Bangalore";
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    ...(trail.coverImage?.url
      ? [{ property: "og:image", content: trail.coverImage.url }]
      : []),
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const trail = await fetchTrailBySlug(params.slug);
  if (!trail) {
    throw data(null, { status: 404 });
  }
  return trail;
}

const difficultyBadge: Record<string, string> = {
  easy: "border-2 border-stone-200 text-accent",
  "easy-moderate": "border-2 border-stone-200 text-accent",
  moderate: "bg-accent text-stone-50",
  "moderate-hard": "border-2 border-accent bg-accent/10 text-accent",
  hard: "bg-stone-200 text-stone-700",
};

function formatMinutes(minutes: number | undefined): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border-2 border-stone-200 bg-stone-100 p-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-bold text-stone-900">{value}</dd>
    </div>
  );
}

export default function TrailDetailPage({
  loaderData: trail,
}: Route.ComponentProps) {
  const imageUrl =
    trail.coverImage && typeof trail.coverImage !== "string"
      ? trail.coverImage.url
      : undefined;

  const badgeClass =
    difficultyBadge[trail.difficulty as string] || "bg-stone-200 text-stone-700";

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Nav */}
      <nav className="border-b border-stone-200">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between h-16">
          <Link to="/trails" className="text-2xl font-bold tracking-tight text-stone-900">
            BLRHikes
          </Link>
          <div className="flex gap-8 text-sm">
            <Link to="/trails" className="font-semibold text-accent">Trails</Link>
            <a href="#" className="text-stone-500 hover:text-stone-900 transition">Community</a>
            <a href="#" className="text-stone-500 hover:text-stone-900 transition">Events</a>
          </div>
        </div>
      </nav>

      {/* Back link */}
      <div className="mx-auto max-w-6xl px-6 pt-6">
        <Link
          to="/trails"
          className="text-sm text-stone-500 hover:text-accent transition"
        >
          ← Back to trails
        </Link>
      </div>

      {/* Hero image */}
      {imageUrl && (
        <div className="mx-auto max-w-6xl px-6 mt-6">
          <div className="relative h-64 sm:h-80 lg:h-96 overflow-hidden rounded-2xl bg-stone-200">
            <img
              src={imageUrl}
              alt={trail.title as string}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      )}

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Title section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-stone-900">
            {trail.title as string}
          </h1>
          {trail.altName && (
            <p className="mt-1 text-lg italic text-stone-500">
              {trail.altName as string}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {trail.area && (
              <span className="text-sm text-stone-600">
                {trail.area as string}
              </span>
            )}
            {trail.difficulty && (
              <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${badgeClass}`}>
                {trail.difficulty as string}
              </span>
            )}
            {trail.rating != null && (
              <span className="text-sm text-accent font-semibold">
                ★ {trail.rating as number}
              </span>
            )}
            {trail.access && (
              <span className="inline-flex items-center rounded-full border-2 border-stone-200 px-3 py-1 text-xs font-medium text-stone-600">
                {(trail.access as string).replace(/_/g, " ")}
              </span>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <dl className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {trail.length != null && (
            <StatItem label="Distance" value={`${trail.length} km`} />
          )}
          {trail.elevationGain != null && (
            <StatItem
              label="Elevation Gain"
              value={`${trail.elevationGain}m`}
            />
          )}
          {trail.elevation != null && (
            <StatItem label="Peak Elevation" value={`${trail.elevation}m`} />
          )}
          {trail.hikingTime != null && (
            <StatItem
              label="Hiking Time"
              value={formatMinutes(trail.hikingTime as number)}
            />
          )}
          {trail.hikingTimeWithRests != null && (
            <StatItem
              label="With Rests"
              value={formatMinutes(trail.hikingTimeWithRests as number)}
            />
          )}
          {trail.hikingTimeWithExploration != null && (
            <StatItem
              label="With Exploration"
              value={formatMinutes(trail.hikingTimeWithExploration as number)}
            />
          )}
          {trail.drivingDistanceText && (
            <StatItem
              label="Driving Distance"
              value={trail.drivingDistanceText as string}
            />
          )}
          {trail.drivingTimeText && (
            <StatItem
              label="Driving Time"
              value={trail.drivingTimeText as string}
            />
          )}
        </dl>

        {/* Highlights */}
        {(trail.highlights as string[] | undefined)?.length ? (
          <div className="mb-8">
            <h2 className="mb-3 text-lg font-bold text-stone-900">
              Highlights
            </h2>
            <div className="flex flex-wrap gap-2">
              {(trail.highlights as string[]).map((h) => (
                <span
                  key={h}
                  className="inline-flex items-center rounded-full border-2 border-accent/20 bg-accent-light px-3 py-1 text-sm font-medium text-stone-700"
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Content */}
        {trail.content && (
          <div className="mb-8">
            <div className="prose prose-stone max-w-none rounded-2xl border-2 border-stone-200 bg-stone-100 p-6">
              <Markdown>{trail.content as string}</Markdown>
            </div>
          </div>
        )}

        {/* Photo gallery */}
        {(trail.photos as any[] | undefined)?.length ? (
          <div className="mb-8">
            <h2 className="mb-3 text-lg font-bold text-stone-900">
              Photos
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {(trail.photos as any[]).map((photo, i) => {
                const photoUrl =
                  photo.image && typeof photo.image !== "string"
                    ? photo.image.url
                    : undefined;
                if (!photoUrl) return null;
                return (
                  <div
                    key={photo.id || i}
                    className="aspect-[4/3] overflow-hidden rounded-2xl border-2 border-stone-200 bg-stone-200"
                  >
                    <img
                      src={photoUrl}
                      alt={photo.image?.alt || `Photo ${i + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
