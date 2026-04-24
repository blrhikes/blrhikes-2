import type { Access, Area, Difficulty, Highlight, UserRole } from "./constants.js";

export interface Trail {
  id: string;
  title: string;
  slug: string;
  altName?: string;

  // Media
  coverImage?: MediaItem;
  gallery?: TrailGalleryItem[];

  // Location
  area?: Area;
  gps?: string;
  relativeLocation?: string;
  // Characteristics
  highlights?: Highlight[];
  rating?: number;
  length?: number;
  elevationGain?: number;
  elevation?: number;
  difficulty?: Difficulty;
  access?: Access;

  // Driving
  drivingDistance?: number;
  drivingDistanceText?: string;
  drivingTime?: number;
  drivingTimeText?: string;

  // Hiking
  hikingTime?: number;
  hikingTimeWithRests?: number;
  hikingTimeWithExploration?: number;

  // GPX / distance
  gpxFile?: MediaItem;
  distanceFromBangalore?: number; // straight-line km from Bangalore centre, auto-calculated

  // Gated
  mapLink?: string;

  // Content
  content?: string; // legacy single blob; prefer `sections` when non-empty
  sections?: TrailSection[];

  // Status
  status: "draft" | "live";
}

export interface MediaItem {
  id: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

/**
 * Array-row shape for the Trails.gallery array in Payload: each row wraps an
 * uploaded image under `.image` rather than being the MediaItem itself.
 */
export interface TrailGalleryItem {
  id?: string;
  image?: MediaItem;
  caption?: string;
}

export interface TrailSectionAttachment {
  id?: string;
  // Normalized shape produced by api.server.ts — the Payload polymorphic
  // `{ relationTo, value }` is flattened into a plain media ref + `kind` tag.
  file?: MediaItem & { kind?: "gpx-files" | "media" };
  label?: string;
}

export interface TrailSection {
  id?: string;
  heading: string;
  slug: string;
  visibility: "public" | "members";
  published?: boolean;
  // null/undefined when the section is gated-out for the current viewer.
  body?: string | null;
  attachments?: TrailSectionAttachment[];
  sourceRef?: string;
}

/**
 * Trail after FE normalization: absolute URLs, flattened relationships,
 * plus the derived `coverImageUrl` field.
 */
export interface NormalizedTrail extends Trail {
  coverImageUrl?: string;
}

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
}

export interface TrailListParams {
  search?: string;
  difficulty?: Difficulty[];
  highlights?: Highlight[];
  access?: Access[];
  hikingDuration?: string;
  area?: Area[];
  sort?: string;
  page?: number;
  limit?: number;
}
