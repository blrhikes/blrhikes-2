import type { TrailListParams } from "@blrhikes/shared";
import { HIKING_DURATION_FILTERS } from "@blrhikes/shared";

const CMS_URL = process.env.CMS_URL || "http://localhost:3000";

// Fields to exclude from public responses (gated fields)
const GATED_FIELDS = ["mapLink", "gps"];

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

  // Highlights filter
  if (params.highlights?.length) {
    params.highlights.forEach((h, i) => {
      qs.set(`where[highlights][in][${i}]`, h);
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

function normalizeTrail<T extends Record<string, unknown>>(doc: T): T {
  const cleaned = { ...doc };

  // Strip gated fields
  for (const field of GATED_FIELDS) {
    delete cleaned[field];
  }

  // Prefix relative image URLs with CMS_URL
  if (cleaned.coverImage && typeof cleaned.coverImage === "object") {
    const img = cleaned.coverImage as Record<string, unknown>;
    if (img.url && typeof img.url === "string" && img.url.startsWith("/")) {
      img.url = `${CMS_URL}${img.url}`;
    }
  }
  if (Array.isArray(cleaned.photos)) {
    cleaned.photos = cleaned.photos.map((p: any) => {
      if (p?.image?.url && typeof p.image.url === "string" && p.image.url.startsWith("/")) {
        return { ...p, image: { ...p.image, url: `${CMS_URL}${p.image.url}` } };
      }
      return p;
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

  return cleaned;
}

export async function fetchTrails(params: TrailListParams) {
  const qs = buildTrailsQuery(params);
  const url = `${CMS_URL}/api/trails?${qs.toString()}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CMS API error: ${res.status}`);
  }

  const data = (await res.json()) as PayloadResponse<Record<string, unknown>>;

  return {
    ...data,
    docs: data.docs.map(normalizeTrail),
  };
}

export async function fetchTrailBySlug(slug: string) {
  const qs = new URLSearchParams();
  qs.set("where[slug][equals]", slug);
  qs.set("where[status][equals]", "live");
  qs.set("limit", "1");

  const url = `${CMS_URL}/api/trails?${qs.toString()}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CMS API error: ${res.status}`);
  }

  const data = (await res.json()) as PayloadResponse<Record<string, unknown>>;

  if (data.docs.length === 0) return null;

  return normalizeTrail(data.docs[0]);
}
