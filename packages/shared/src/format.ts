import type { Trail } from "./types.js";

/**
 * Display name for a trail: altName, with the gh-issue-number as fallback
 * for trails missing an altName. Title is intentionally not shown.
 */
export function trailDisplayName(trail: Pick<Trail, "altName" | "githubIssueNumber">): string {
  if (trail.altName) return trail.altName;
  if (trail.githubIssueNumber != null) return `#${trail.githubIssueNumber}`;
  return "";
}

/**
 * Round a minute count to whole hours, with a floor of 1 so very short
 * trails don't render as "0 hours".
 */
export function roundToHours(minutes: number): number {
  return Math.max(1, Math.round(minutes / 60));
}

/**
 * Render two minute counts as a whole-hour range ("2-3 hours").
 * When both endpoints round to the same bucket the range collapses
 * to a single value ("3 hours"), with singular "1 hour" for n === 1.
 *
 * Intended for showing a hiking-time estimate spanning
 * hikingTimeWithRests (lower) and hikingTimeWithExploration (upper).
 */
export function formatHikingTimeRange(lowerMinutes: number, upperMinutes: number): string {
  const l = roundToHours(lowerMinutes);
  const u = roundToHours(upperMinutes);
  if (l === u) return `${l} ${l === 1 ? "hour" : "hours"}`;
  return `${l}-${u} hours`;
}
