import type { Access, Area, Difficulty, Highlight } from "./constants.js";

export interface Trail {
  id: string;
  title: string;
  slug: string;
  altName?: string;

  // Media
  coverImage?: MediaItem;
  photos?: MediaItem[];

  // Location
  area?: Area;
  gps?: string;
  relativeLocation?: string;
  isLocal?: boolean;

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
  content?: string;

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
