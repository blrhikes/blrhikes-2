import { Form, Link, data } from "react-router";
import type { Route } from "./+types/trail-detail";
import { fetchTrailBySlug } from "../lib/api.server";
import type { AuthUser } from "@blrhikes/shared";
import Markdown from "react-markdown";
import rehypeExternalLinks from "rehype-external-links";
import { BottomNav } from "../components/bottom-nav";

function heroImageUrl(url: string): string {
  return url.replace(/width=\d+/, "width=1920");
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  const trail = loaderData?.trail;
  if (!trail) {
    return [{ title: "Trail Not Found | BLR Hikes" }];
  }
  const title = `${trail.title} | BLR Hikes`;
  const description = trail.area ? `Hiking trail in ${trail.area} near Bangalore` : "Hiking trail near Bangalore";
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    ...(trail.coverImageUrl ? [{ property: "og:image", content: trail.coverImageUrl }] : []),
  ];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const trail = await fetchTrailBySlug(params.slug, context.payloadToken ?? undefined);
  if (!trail) {
    throw data(null, { status: 404 });
  }
  return { trail, user: context.user, cmsUrl: context.cmsUrl };
}

const accessLevels: Record<string, { icon: string; text: string; subtitle: string }> = {
  PERMIT_REQUIRED: {
    icon: "🎟️",
    text: "Permit Required",
    subtitle: "Buy permit via Aranya Vihaara",
  },
  OPEN_ACCESS: {
    icon: "✅",
    text: "Open Access",
    subtitle: "No permit required",
  },
  TRACKED_ACCESS: {
    icon: "📋",
    text: "Tracked Access",
    subtitle: "Officials will note your ID at the trailhead",
  },
  RESTRICTED: {
    icon: "🚫",
    text: "Restricted",
    subtitle: "You won't be able to get a permit to hike here",
  },
  UNMONITORED: {
    icon: "",
    text: "Unmonitored",
    subtitle: "No official monitoring. Hike at your own risk.",
  },
};

function formatMinutes(minutes: number | undefined): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function Stat({
  value,
  unit,
  label,
  size = "md",
  extraClass = "",
}: {
  value: string;
  unit?: string;
  label: string;
  size?: "xs" | "sm" | "md" | "lg";
  extraClass?: string;
}) {
  const sizeClasses = {
    xs: "text-sm md:text-base",
    sm: "text-base md:text-lg",
    md: "text-xl md:text-2xl",
    lg: "text-2xl md:text-3xl",
  };

  return (
    <div className={`flex flex-col ${extraClass}`}>
      <span className={`font-semibold ${sizeClasses[size]}`}>
        {value}
        {unit && <span className="ml-0.5 text-sm font-normal text-stone-500">{unit}</span>}
      </span>
      <span className="text-xs text-stone-500 md:text-sm">{label}</span>
    </div>
  );
}

function Tag({ text }: { text: string }) {
  return (
    <span className="inline-block rounded-full border border-stone-300 px-3 py-1 text-xs capitalize md:text-sm">
      {text}
    </span>
  );
}

export default function TrailDetailPage({ loaderData }: Route.ComponentProps) {
  const { trail, user, cmsUrl } = loaderData;
  const imageUrl = trail.coverImageUrl ? heroImageUrl(trail.coverImageUrl as string) : undefined;
  const access = trail.access as string | undefined;
  const accessInfo = access ? accessLevels[access] : undefined;
  const highlights = trail.highlights as string[] | undefined;
  const canEdit = user && (user.role === "admin" || user.role === "contributor");
  const cmsAdminUrl = `${cmsUrl}/admin/collections/trails/${trail.id}`;

  return (
    <div className="min-h-screen bg-stone-50 pb-20 sm:pb-0">
      {/* Hero Section — full-bleed image with overlaid content */}
      <section className="relative -mt-0 h-[70vh] lg:h-[95vh]">
        {imageUrl ? (
          <img src={imageUrl} alt={trail.title as string} className="h-full w-full object-cover object-top" />
        ) : (
          <div className="h-full w-full bg-stone-300" />
        )}

        {/* Top nav bar — full-width frosted glass */}
        <div className="absolute top-0 z-10 flex w-full items-center justify-between bg-stone-900/60 backdrop-blur-md px-6 py-3 text-stone-50 shadow-lg lg:px-12">
          <Link to="/" className="text-lg font-bold tracking-tight lg:text-2xl">
            BLRHikes
          </Link>
          <nav className="hidden items-center gap-6 text-sm lg:flex">
            <Link to="/trails" className="decoration-yellow-500 decoration-2 underline-offset-2 hover:underline">
              Trails
            </Link>
            {user ? (
              <Form method="post" action="/logout">
                <button type="submit" className="decoration-yellow-500 decoration-2 underline-offset-2 hover:underline">
                  Log out
                </button>
              </Form>
            ) : (
              <Link to="/login" className="decoration-yellow-500 decoration-2 underline-offset-2 hover:underline">
                Log in
              </Link>
            )}
          </nav>
        </div>

        {/* Bottom gradient + content overlay */}
        <div className="absolute bottom-0 flex h-full w-full items-end bg-gradient-to-t from-black/70 via-black/15 to-transparent">
          <div className="mx-auto flex w-full flex-col justify-end p-6 text-stone-50 lg:max-w-5xl lg:p-4 lg:px-0 lg:pb-12 xl:max-w-6xl 2xl:max-w-7xl">
            {/* Bottom row: trail info */}
            <div>
              <Link
                to="/trails"
                className="mb-4 inline-block rounded-lg bg-black/50 px-3 py-1.5 text-sm transition hover:bg-black/70"
              >
                ← Back to Trails
              </Link>
              <h1 className="text-4xl font-bold text-white lg:text-5xl">{trail.title as string}</h1>
              {trail.altName && <p className="mt-1 text-lg italic text-stone-300">{trail.altName as string}</p>}
              <p className="mt-2 text-xl font-semibold text-white lg:text-3xl">{trail.area as string}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <article className="prose prose-xl prose-stone mx-auto max-w-4xl px-6 pb-32 pt-6 lg:prose-xl xl:prose-2xl sm:px-12">
        {/* Edit link for admins/contributors */}
        {canEdit && (
          <div className="not-prose mb-4">
            <a
              href={cmsAdminUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-accent bg-accent-light px-3 py-1.5 text-sm font-medium text-stone-900 transition hover:bg-accent"
            >
              Edit Trail ✏️
            </a>
          </div>
        )}

        {/* Access + Difficulty + Rating + Tags row */}
        <div className="not-prose flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <div className="flex w-full flex-wrap items-center justify-between gap-4">
            {accessInfo && (
              <Stat
                value={`${accessInfo.icon} ${accessInfo.text}`}
                label={accessInfo.subtitle}
                extraClass="capitalize"
                size="sm"
              />
            )}
            {trail.difficulty && (
              <Stat value={trail.difficulty as string} label="Difficulty" size="sm" extraClass="capitalize" />
            )}
            {trail.rating != null && <Stat value={`${trail.rating}/5`} label="Rating" />}
            {highlights && highlights.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {highlights.map((h) => (
                  <Tag key={h} text={h} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="not-prose grid grid-cols-3 gap-2 border-b border-stone-200 py-4 md:flex md:items-center md:justify-between md:py-3">
          {trail.length != null && <Stat value={String(trail.length)} unit="km" label="Total Length" />}
          {trail.elevationGain != null && <Stat value={String(trail.elevationGain)} unit="m" label="Elevation Gain" />}
          {(trail.hikingTime != null || trail.hikingTimeWithRests != null) && (
            <Stat
              value={
                trail.hikingTime != null && trail.hikingTimeWithRests != null
                  ? `${formatMinutes(trail.hikingTime as number)}-${formatMinutes(trail.hikingTimeWithRests as number)}`
                  : formatMinutes((trail.hikingTime ?? trail.hikingTimeWithRests) as number)
              }
              label="Hiking Time"
            />
          )}
          {(trail.drivingTimeText || trail.drivingDistanceText) && (
            <>
              <div className="hidden md:mx-2 md:block md:h-12 md:border-l md:border-stone-200" />
              <Stat
                value={[trail.drivingTimeText, trail.drivingDistanceText ? `${trail.drivingDistanceText} away` : ""]
                  .filter(Boolean)
                  .join(" or ")}
                size="xs"
                label="Approx. driving time and distance"
                extraClass="col-span-3 pt-4 md:pt-0 md:col-span-1"
              />
            </>
          )}
        </div>

        {/* Action buttons — gated fields (gps, mapLink) only appear if CMS returned them */}
        <div className="not-prose mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
          {trail.gps && (
            <a
              className="col-span-1 flex items-center justify-center rounded-lg bg-gradient-to-b from-stone-50 to-stone-200 px-4 pb-2 pt-3 text-center text-2xl font-semibold text-black shadow shadow-black/40 transition-all hover:from-yellow-50 hover:to-yellow-100 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 md:col-span-2"
              href={`https://www.google.com/maps?q=${trail.gps}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Trailhead Location 📍
            </a>
          )}
          {trail.mapLink && (
            <a
              className="flex flex-col justify-center rounded-lg bg-gradient-to-b from-stone-50 to-stone-200 px-4 pb-2 pt-3 text-center text-2xl font-semibold text-black shadow shadow-black/40 transition-all hover:from-yellow-50 hover:to-yellow-100 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2"
              href={trail.mapLink as string}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div>Trail Map 🔗</div>
              <div className="text-sm font-normal">GaiaGPS Link</div>
            </a>
          )}
        </div>

        {/* Trail content (markdown) */}
        {trail.content && (
          <div className="mt-8">
            <Markdown rehypePlugins={[[rehypeExternalLinks, { target: "_blank", rel: ["noopener", "noreferrer"] }]]}>
              {trail.content as string}
            </Markdown>
          </div>
        )}

        {/* Photo gallery */}
        {(trail.photos as any[] | undefined)?.length ? (
          <div className="not-prose mt-8">
            <h2 className="mb-3 text-lg font-bold text-stone-900">Photos</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {(trail.photos as any[]).map((photo, i) => {
                const photoUrl = photo.image && typeof photo.image !== "string" ? photo.image.url : undefined;
                if (!photoUrl) return null;
                return (
                  <div key={photo.id || i} className="aspect-[4/3] overflow-hidden rounded-lg bg-stone-200">
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
      </article>
      <BottomNav />
    </div>
  );
}
