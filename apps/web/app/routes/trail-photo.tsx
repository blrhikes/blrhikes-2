import { Link, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/trail-photo";
import type { NormalizedTrail } from "@blrhikes/shared";

export default function TrailPhotoPage({ params }: Route.ComponentProps) {
  const parent = useRouteLoaderData("routes/trail-detail") as
    | { trail: NormalizedTrail }
    | undefined;
  const trail = parent?.trail;
  const photoId = params.photoId;

  const gallery = trail?.gallery ?? [];
  const index = gallery.findIndex((g) => String(g.image?.id) === photoId);
  const photo = index >= 0 ? gallery[index] : undefined;

  if (!trail || !photo?.image?.url) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/95 text-stone-100">
        <div className="text-center">
          <p className="text-lg">Photo not found.</p>
          <Link
            to={trail ? `/trails/${trail.slug}` : "/trails"}
            className="mt-4 inline-block rounded-md bg-stone-100 px-4 py-2 text-stone-900"
          >
            Back
          </Link>
        </div>
      </div>
    );
  }

  const prev = gallery[index - 1];
  const next = gallery[index + 1];
  const backUrl = `/trails/${trail.slug}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-950/97 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3 text-stone-100">
        <div className="text-sm text-stone-400">
          {index + 1} / {gallery.length}
        </div>
        <Link
          to={backUrl}
          viewTransition
          aria-label="Close photo"
          className="rounded-md bg-stone-800/80 px-3 py-1.5 text-sm text-stone-100 transition hover:bg-stone-700"
        >
          Close ✕
        </Link>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-2 pb-4 sm:px-6">
        <img
          src={photo.image.url}
          alt={photo.image.alt || photo.caption || `Photo ${index + 1}`}
          style={{ viewTransitionName: "trail-photo" }}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        />
      </div>
      {photo.caption && (
        <div className="px-6 pb-4 text-center text-sm text-stone-300">
          {photo.caption}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 px-4 pb-6 sm:px-8">
        {prev?.image?.id ? (
          <Link
            to={`/trails/${trail.slug}/photo/${prev.image.id}`}
            viewTransition
            replace
            className="rounded-md bg-stone-800/80 px-4 py-2 text-sm text-stone-100 transition hover:bg-stone-700"
          >
            ← Prev
          </Link>
        ) : (
          <span />
        )}
        {next?.image?.id ? (
          <Link
            to={`/trails/${trail.slug}/photo/${next.image.id}`}
            viewTransition
            replace
            className="rounded-md bg-stone-800/80 px-4 py-2 text-sm text-stone-100 transition hover:bg-stone-700"
          >
            Next →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
