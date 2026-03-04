import { Link } from "react-router";

const difficultyBadge: Record<string, string> = {
  easy: "bg-stone-200 text-stone-700",
  "easy-moderate": "bg-stone-200 text-stone-700",
  moderate: "bg-stone-200 text-stone-700",
  "moderate-hard": "bg-stone-200 text-stone-700",
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

function getCoverImageUrl(trail: any): string | undefined {
  return trail.coverImageUrl || undefined;
}

export function TrailCard({
  trail,
  mode,
}: {
  trail: any;
  mode: "grid" | "list";
}) {
  const imageUrl = getCoverImageUrl(trail);
  const badgeClass =
    difficultyBadge[trail.difficulty] || "bg-stone-200 text-stone-700";

  if (mode === "list") {
    return (
      <Link
        to={`/trails/${trail.slug}`}
        className="flex gap-4 items-center rounded-2xl border-2 border-stone-200 bg-stone-100 p-4 transition hover:border-accent"
      >
        {/* Image */}
        <div className="h-20 w-32 flex-shrink-0 overflow-hidden rounded-lg bg-stone-200">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={trail.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-stone-400 text-xs">
              No image
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-stone-900">{trail.title}</h3>
          {trail.area && (
            <p className="text-sm text-stone-500">
              {trail.area}
              {trail.drivingDistanceText && ` · ${trail.drivingDistanceText} from Bangalore`}
            </p>
          )}
          <p className="text-xs text-stone-500 mt-1">
            {trail.length != null && `${trail.length} km`}
            {trail.elevationGain != null && ` · ${trail.elevationGain}m elevation`}
            {trail.hikingTime != null && ` · ${formatMinutes(trail.hikingTime)}`}
            {trail.difficulty && ` · ${trail.difficulty}`}
          </p>
          {trail.highlights?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {trail.highlights.slice(0, 5).map((h: string) => (
                <span
                  key={h}
                  className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs"
                >
                  {h}
                </span>
              ))}
            </div>
          )}
        </div>

        {trail.rating != null && (
          <span className="text-stone-600 font-semibold text-sm flex-shrink-0">
            ★ {trail.rating}
          </span>
        )}
      </Link>
    );
  }

  // Grid mode
  return (
    <Link
      to={`/trails/${trail.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border-2 border-stone-200 bg-stone-100 transition-all duration-200 hover:border-accent hover:-translate-y-1"
    >
      {/* Image */}
      <div className="aspect-[4/3] overflow-hidden bg-stone-200">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={trail.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone-400 text-sm">
            No image
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        {trail.difficulty && (
          <span className={`self-start rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wider mb-2 ${badgeClass}`}>
            {trail.difficulty}
          </span>
        )}

        <h3 className="text-xl font-bold text-stone-900 leading-tight">
          {trail.title}
        </h3>

        <p className="text-sm text-stone-500 mt-1">
          {trail.length != null && `${trail.length} km`}
          {trail.hikingTime != null && ` · ${formatMinutes(trail.hikingTime)}`}
          {trail.elevationGain != null && ` · Elevation gain: ${trail.elevationGain}m`}
        </p>

        {/* Tags */}
        {trail.highlights?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {trail.highlights.slice(0, 4).map((h: string) => (
              <span
                key={h}
                className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs"
              >
                {h}
              </span>
            ))}
            {trail.highlights.length > 4 && (
              <span className="text-xs text-stone-400">
                +{trail.highlights.length - 4}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-stone-500">
          <span>
            {trail.area || ""}
            {trail.drivingDistanceText && ` · ${trail.drivingDistanceText}`}
          </span>
          {trail.rating != null && (
            <span className="text-stone-600 font-semibold">★ {trail.rating}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
