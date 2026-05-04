import { Form, Link, Outlet, data, redirect, useViewTransitionState } from "react-router";
import type { Route } from "./+types/trail-detail";
import { fetchTrailById, fetchTrailByGithubIssueNumber, fetchTrailBySlug } from "../lib/api.server";
import {
  formatHikingTimeRange,
  roundToHours,
  trailDisplayName,
  type AuthUser,
  type TrailSection,
  type TrailGalleryItem,
} from "@blrhikes/shared";
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
  const title = `${trailDisplayName(trail)} | BLR Hikes`;
  const description = trail.area ? `Hiking trail in ${trail.area} near Bangalore` : "Hiking trail near Bangalore";
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    ...(trail.coverImageUrl ? [{ property: "og:image", content: trail.coverImageUrl }] : []),
  ];
}

// URL resolution:
//   /trail/glasswater-lake-332        → exact slug lookup (slug is unique)
//   /trail/glasswater-lake-hike       → exact slug lookup (covers legacy `<id>-<altName>` shape too)
//   /trail/332                        → bare-digit shortcut: try gh-issue-number=332, then Payload id=332
// Canonical slug = `<altName-slug>-<num>` where num is githubIssueNumber when present,
// otherwise Payload row id (Trails.ts hooks keep it current).
// Anything-with-a-dash is treated as a slug first, since slug uniqueness eliminates ambiguity
// between gh-issue and row-id namespaces colliding on the same trailing number.
// Legacy plural `/trails/:slug` is handled by trails-redirect.tsx → 301 to /trail/:slug.
export async function loader({ params, context }: Route.LoaderArgs) {
  const segment = params.slug;
  const token = context.payloadToken ?? undefined;
  const bareDigits = /^\d+$/.test(segment);

  let trail = bareDigits ? null : await fetchTrailBySlug(context.cmsUrl, segment, token);
  if (!trail && bareDigits) {
    const num = Number(segment);
    trail =
      (await fetchTrailByGithubIssueNumber(context.cmsUrl, num, token)) ??
      (await fetchTrailById(context.cmsUrl, num, token));
  }

  if (!trail) {
    throw data(null, { status: 404 });
  }

  // Redirect any non-canonical URL (bare id, old slug, stale slug) to the
  // current canonical slug so links stay tidy and SEO is happy.
  if (trail.slug && trail.slug !== segment) {
    throw redirect(`/trail/${trail.slug}`);
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

// A section is "locked" when the afterRead hook wiped its body for an
// unentitled viewer. We infer this from (visibility === 'members') + !body
// rather than a separate API flag.
function isSectionLocked(section: TrailSection): boolean {
  return section.visibility === "members" && !section.body;
}

function TableOfContents({ sections }: { sections: TrailSection[] }) {
  if (sections.length < 2) return null;
  return (
    <nav
      aria-label="On this page"
      className="not-prose my-8 rounded-lg border border-stone-200 bg-white/60 p-4 text-sm"
    >
      <p className="mb-2 font-semibold text-stone-700">On this page</p>
      <ol className="flex flex-col gap-1">
        {sections.map((s) => (
          <li key={s.slug}>
            <a
              href={`#${s.slug}`}
              className="text-stone-700 underline decoration-stone-300 underline-offset-2 hover:decoration-stone-600"
            >
              {s.heading}
            </a>
            {isSectionLocked(s) && (
              <span className="ml-2 text-xs text-stone-500" aria-label="Members only">
                🔒 Members
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function SectionBlock({ section }: { section: TrailSection }) {
  const locked = isSectionLocked(section);
  return (
    <section className="mt-10 first:mt-8">
      <h2 id={section.slug} className="scroll-mt-24">
        {section.heading}
        {locked && (
          <span className="ml-2 align-middle text-sm text-stone-500" aria-label="Members only">
            🔒
          </span>
        )}
      </h2>
      {locked ? (
        <div className="not-prose rounded-lg border border-stone-200 bg-stone-50 p-4 text-stone-700">
          <p className="mb-2 text-sm">
            This section is for members. Log in or upgrade to unlock detailed route notes,
            local tips, and downloads.
          </p>
          <Link
            to="/login"
            className="inline-block rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 transition hover:bg-stone-800"
          >
            Log in / Become a member
          </Link>
        </div>
      ) : (
        <>
          {section.body && (
            <Markdown
              rehypePlugins={[[rehypeExternalLinks, { target: "_blank", rel: ["noopener", "noreferrer"] }]]}
            >
              {section.body}
            </Markdown>
          )}
          {section.attachments && section.attachments.length > 0 && (
            <ul className="not-prose mt-4 flex flex-col gap-2">
              {section.attachments.map((att, i) => {
                const url = att.file?.url;
                if (!url) return null;
                const label = att.label || att.file?.alt || `Download ${i + 1}`;
                const isGpx = att.file?.kind === "gpx-files";
                return (
                  <li key={att.id || i}>
                    <a
                      href={url}
                      download
                      className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
                    >
                      <span>{isGpx ? "📥" : "📎"}</span>
                      <span>{label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function GalleryThumbnail({
  trailSlug,
  photo,
  index,
}: {
  trailSlug: string;
  photo: TrailGalleryItem;
  index: number;
}) {
  const url = photo.image?.url;
  const mediaId = photo.image?.id;
  const to = mediaId ? `/trail/${trailSlug}/photo/${mediaId}` : undefined;
  // useViewTransitionState returns true only while *this* link is the active
  // transition participant — applying the transition name conditionally
  // prevents collisions between multiple thumbnails and the detail image.
  const isTransitioning = useViewTransitionState(to || "");

  if (!url) return null;

  const img = (
    <img
      src={url}
      alt={photo.image?.alt || photo.caption || `Photo ${index + 1}`}
      loading="lazy"
      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
      style={isTransitioning ? { viewTransitionName: "trail-photo" } : undefined}
    />
  );

  const wrapper = "group block aspect-[4/3] overflow-hidden rounded-lg bg-stone-200";

  if (!to) {
    return <div className={wrapper}>{img}</div>;
  }

  return (
    <Link to={to} viewTransition className={wrapper}>
      {img}
    </Link>
  );
}

export default function TrailDetailPage({ loaderData }: Route.ComponentProps) {
  const { trail, user, cmsUrl } = loaderData;
  const imageUrl = trail.coverImageUrl ? heroImageUrl(trail.coverImageUrl) : undefined;
  const accessInfo = trail.access ? accessLevels[trail.access] : undefined;
  const highlights = trail.highlights;
  const canEdit = user && (user.role === "admin" || user.role === "contributor");
  const cmsAdminUrl = `${cmsUrl}/admin/collections/trails/${trail.id}`;

  return (
    <div className="min-h-screen bg-stone-50 pb-20 sm:pb-0">
      {/* Hero Section — full-bleed image with overlaid content */}
      <section className="relative -mt-0 h-[70vh] lg:h-[95vh]">
        {imageUrl ? (
          <img src={imageUrl} alt={trailDisplayName(trail)} className="h-full w-full object-cover object-top" />
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
              <h1 className="text-4xl font-bold text-white lg:text-5xl">{trailDisplayName(trail)}</h1>
              {trail.area && (
                <p className="mt-2 text-xl font-semibold text-white lg:text-3xl">{trail.area}</p>
              )}
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
          {(() => {
            const { hikingTimeWithRests: lo, hikingTimeWithExploration: hi } = trail;
            if (lo == null && hi == null) return null;
            let value: string;
            if (lo != null && hi != null) {
              value = formatHikingTimeRange(lo, hi);
            } else {
              const h = roundToHours((lo ?? hi) as number);
              value = `${h} ${h === 1 ? "hour" : "hours"}`;
            }
            return <Stat value={value} label="Hiking Time" />;
          })()}
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
              href={trail.mapLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div>Trail Map 🔗</div>
              <div className="text-sm font-normal">GaiaGPS Link</div>
            </a>
          )}
          {trail.gpxFile?.url && (
            <a
              className="flex flex-col justify-center rounded-lg bg-gradient-to-b from-stone-50 to-stone-200 px-4 pb-2 pt-3 text-center text-2xl font-semibold text-black shadow shadow-black/40 transition-all hover:from-yellow-50 hover:to-yellow-100 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2"
              href={trail.gpxFile.url}
              download
            >
              <div>Download GPX 📥</div>
              <div className="text-sm font-normal">Load into Gaia, Komoot, etc.</div>
            </a>
          )}
        </div>

        {/* Body: structured sections preferred, fall back to legacy `content` */}
        {trail.sections && trail.sections.length > 0 ? (
          <>
            <TableOfContents sections={trail.sections} />
            {trail.sections.map((section) => (
              <SectionBlock key={section.id || section.slug} section={section} />
            ))}
          </>
        ) : (
          trail.content && (
            <div className="mt-8">
              <Markdown rehypePlugins={[[rehypeExternalLinks, { target: "_blank", rel: ["noopener", "noreferrer"] }]]}>
                {trail.content}
              </Markdown>
            </div>
          )
        )}

        {/* Photo gallery — view-transitions grid; thumbnail → nested photo route */}
        {trail.gallery && trail.gallery.length > 0 && (
          <div className="not-prose mt-12">
            <h2 className="mb-3 text-lg font-bold text-stone-900">Photos</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {trail.gallery.map((photo, i) => (
                <GalleryThumbnail
                  key={photo.id || i}
                  trailSlug={trail.slug}
                  photo={photo}
                  index={i}
                />
              ))}
            </div>
          </div>
        )}
      </article>
      <BottomNav />
      {/* Nested photo overlay (trail/:slug/photo/:photoId) */}
      <Outlet />
    </div>
  );
}
