export const DIFFICULTY_OPTIONS = [
  "easy",
  "easy-moderate",
  "moderate",
  "moderate-hard",
  "hard",
] as const;

export type Difficulty = (typeof DIFFICULTY_OPTIONS)[number];

export const ACCESS_OPTIONS = [
  "OPEN_ACCESS",
  "PERMIT_REQUIRED",
  "TRACKED_ACCESS",
  "RESTRICTED",
  "UNMONITORED",
] as const;

export type Access = (typeof ACCESS_OPTIONS)[number];

export const HIGHLIGHT_OPTIONS = [
  "lake",
  "cave",
  "forest",
  "waterfall",
  "temple",
  "scramble",
  "camping",
  "kid-friendly",
  "pet-friendly",
  "beginner-friendly",
  "swimming",
  "rock-shelter",
  "wild-camping",
  "hilltop",
  "quarry",
  "dolmens",
  "pond",
  "bushwhack",
  "stream",
  "exposed",
  "clifftop",
  "arch",
] as const;

export type Highlight = (typeof HIGHLIGHT_OPTIONS)[number];

export const AREA_OPTIONS = [
  "Ramanagara",
  "Kanakapura",
  "Kolar",
  "Chikkaballapur",
  "Tumkur",
  "Mandya",
  "Hassan",
  "Mysuru",
  "Chamarajanagar",
  "Sakleshpur",
  "Chikkamagaluru",
  "Kodagu",
  "Unknown",
] as const;

export type Area = (typeof AREA_OPTIONS)[number];

export const HIKING_DURATION_FILTERS = {
  short: { label: "Short (<2h)", maxMinutes: 120 },
  medium: { label: "Medium (2-4h)", minMinutes: 120, maxMinutes: 240 },
  long: { label: "Long (>4h)", minMinutes: 240 },
} as const;

export type HikingDuration = keyof typeof HIKING_DURATION_FILTERS;

export const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  easy: 1,
  "easy-moderate": 2,
  moderate: 3,
  "moderate-hard": 4,
  hard: 5,
};

export const ROLE_OPTIONS = ["admin", "contributor", "lifetime", "yearly"] as const;

export type UserRole = (typeof ROLE_OPTIONS)[number];
