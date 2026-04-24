import type { NormalizedTrail, TrailListParams } from "@blrhikes/shared";
import { HIKING_DURATION_FILTERS } from "@blrhikes/shared";

interface PayloadResponse<T> {
  docs: T[];
  totalDocs: number;
  totalPages: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

function buildTrailsQuery(params: TrailListParams): URLSearchParams {
  const qs = new URLSearchParams();

  // Pagination
  qs.set("limit", String(params.limit || 32));
  if (params.page) qs.set("page", String(params.page));

  // Status filter - only show live trails
  qs.set("where[status][equals]", "live");

  let whereIndex = 0;

  // Text search on title
  if (params.search) {
    qs.set("where[or][0][title][like]", params.search);
    qs.set("where[or][1][area][like]", params.search);
    qs.set("where[or][2][altName][like]", params.search);
  }

  // Difficulty filter
  if (params.difficulty?.length) {
    params.difficulty.forEach((d, i) => {
      qs.set(`where[difficulty][in][${i}]`, d);
    });
  }

  // Highlights filter (relationship field — query by related doc's name)
  if (params.highlights?.length) {
    params.highlights.forEach((h, i) => {
      qs.set(`where[highlights.name][in][${i}]`, h);
    });
  }

  // Access filter
  if (params.access?.length) {
    params.access.forEach((a, i) => {
      qs.set(`where[access][in][${i}]`, a);
    });
  }

  // Area filter
  if (params.area?.length) {
    params.area.forEach((a, i) => {
      qs.set(`where[area][in][${i}]`, a);
    });
  }

  // Hiking duration filter
  if (params.hikingDuration) {
    const filter =
      HIKING_DURATION_FILTERS[
        params.hikingDuration as keyof typeof HIKING_DURATION_FILTERS
      ];
    if (filter) {
      if ("maxMinutes" in filter) {
        qs.set("where[hikingTime][less_than_equal]", String(filter.maxMinutes));
      }
      if ("minMinutes" in filter) {
        qs.set(
          "where[hikingTime][greater_than_equal]",
          String(filter.minMinutes)
        );
      }
    }
  }

  // Sorting
  if (params.sort) {
    qs.set("sort", params.sort);
  }

  return qs;
}

function buildHeaders(payloadToken?: string): HeadersInit {
  if (!payloadToken) return {};
  return { Cookie: `payload-token=${payloadToken}` };
}

function normalizeTrail(doc: Record<string, unknown>, cmsUrl: string): NormalizedTrail {
  const cleaned: Record<string, unknown> = { ...doc };

  // Flatten coverImage group → coverImageUrl string
  const coverImage = cleaned.coverImage as
    | { type?: string; url?: string; image?: { url?: string } | string }
    | undefined;
  if (coverImage) {
    if (coverImage.type === 'upload' && coverImage.image) {
      const imgUrl =
        typeof coverImage.image === 'string'
          ? coverImage.image
          : coverImage.image?.url;
      if (imgUrl) {
        cleaned.coverImageUrl = imgUrl.startsWith('/') ? `${cmsUrl}${imgUrl}` : imgUrl;
      }
    } else if (coverImage.url) {
      cleaned.coverImageUrl = coverImage.url;
    }
  }

  // Absolutize gpxFile URL so the <a download> link works cross-origin
  const gpxFile = cleaned.gpxFile as { url?: string } | undefined;
  if (gpxFile?.url && typeof gpxFile.url === "string" && gpxFile.url.startsWith("/")) {
    cleaned.gpxFile = { ...gpxFile, url: `${cmsUrl}${gpxFile.url}` };
  }

  if (Array.isArray(cleaned.gallery)) {
    cleaned.gallery = cleaned.gallery.map((g: any) => {
      if (g?.image?.url && typeof g.image.url === "string" && g.image.url.startsWith("/")) {
        return { ...g, image: { ...g.image, url: `${cmsUrl}${g.image.url}` } };
      }
      return g;
    });
  }

  // Normalize sections[]: absolutize attachment URLs and flatten the
  // polymorphic `file` relation ({ relationTo, value }) into a plain media ref
  // with an extra `kind` tag so the frontend knows whether it's a GPX or other file.
  if (Array.isArray(cleaned.sections)) {
    cleaned.sections = cleaned.sections.map((s: any) => {
      const attachments = Array.isArray(s?.attachments)
        ? s.attachments.map((a: any) => {
            const rel = a?.file;
            if (!rel) return a;
            // Polymorphic upload: rel = { relationTo, value: <media doc | id> }
            const kind: "gpx-files" | "media" | undefined = rel.relationTo;
            const value = rel.value ?? rel;
            const media =
              value && typeof value === "object"
                ? value
                : { id: value };
            const absUrl =
              media?.url && typeof media.url === "string" && media.url.startsWith("/")
                ? `${cmsUrl}${media.url}`
                : media?.url;
            return {
              ...a,
              file: { ...media, url: absUrl, kind },
            };
          })
        : s?.attachments;
      return { ...s, attachments };
    });
  }

  // Flatten area relationship to string
  if (cleaned.area && typeof cleaned.area === "object" && "name" in (cleaned.area as any)) {
    cleaned.area = (cleaned.area as any).name;
  }

  // Flatten highlights relationship to string array
  if (Array.isArray(cleaned.highlights)) {
    cleaned.highlights = cleaned.highlights.map((h: any) =>
      typeof h === "object" && h?.name ? h.name : h
    );
  }

  return cleaned as unknown as NormalizedTrail;
}

export async function fetchTrails(
  cmsUrl: string,
  params: TrailListParams,
  payloadToken?: string,
): Promise<PayloadResponse<NormalizedTrail>> {
  const qs = buildTrailsQuery(params);
  const url = `${cmsUrl}/api/trails?${qs.toString()}`;

  const res = await fetch(url, { headers: buildHeaders(payloadToken) });
  if (!res.ok) {
    throw new Error(`CMS API error: ${res.status}`);
  }

  const data = (await res.json()) as PayloadResponse<Record<string, unknown>>;

  return {
    ...data,
    docs: data.docs.map((doc) => normalizeTrail(doc, cmsUrl)),
  };
}

export async function fetchTrailBySlug(
  cmsUrl: string,
  slug: string,
  payloadToken?: string,
): Promise<NormalizedTrail | null> {
  const qs = new URLSearchParams();
  qs.set("where[slug][equals]", slug);
  qs.set("where[status][equals]", "live");
  qs.set("limit", "1");

  const url = `${cmsUrl}/api/trails?${qs.toString()}`;

  const res = await fetch(url, { headers: buildHeaders(payloadToken) });
  if (!res.ok) {
    throw new Error(`CMS API error: ${res.status}`);
  }

  const data = (await res.json()) as PayloadResponse<Record<string, unknown>>;

  if (data.docs.length === 0) return null;

  return normalizeTrail(data.docs[0], cmsUrl);
}

export async function fetchTrailById(
  cmsUrl: string,
  id: number,
  payloadToken?: string,
): Promise<NormalizedTrail | null> {
  // Using /api/trails/:id returns a single doc directly. Status filter is
  // applied in-memory since the by-id endpoint doesn't support `where`.
  const url = `${cmsUrl}/api/trails/${id}`;
  const res = await fetch(url, { headers: buildHeaders(payloadToken) });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`CMS API error: ${res.status}`);
  }
  const doc = (await res.json()) as Record<string, unknown>;
  if (doc.status !== "live") return null;
  return normalizeTrail(doc, cmsUrl);
}
