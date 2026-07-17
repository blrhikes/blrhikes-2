/**
 * Legacy `computed*` frontmatter block — compatibility shim for the old
 * `blrhikes-webhook-listeners` pipeline, which is still in production.
 *
 * That webhook wrote a set of `computed*` keys into each trail's GitHub-issue
 * frontmatter (and a Supabase `trails` row). The blrhikes-2 CMS computes the
 * same underlying numbers under different field names, so this module re-emits
 * them in the exact legacy shape for copy-paste back into the legacy system.
 *
 * Notes on fidelity to the legacy output:
 *  - `computedRemote` / `computedLocal` are NOT semantic flags — the old webhook
 *    set them to `true` as idempotency guards. We keep them `true` verbatim so
 *    the legacy app keeps working.
 *  - Hiking times are derived from this CMS's stored values (Naismith 5/600,
 *    minutes), re-expressed as hours + `Math.ceil`-rounded hours to match the
 *    legacy `timeOnTrail.js` output structure. Exact decimals will differ from
 *    the legacy 3.5/350 formula — by design.
 *  - Driving distance/time use the raw (unrounded km / raw seconds) HERE values
 *    captured at GPX-parse time.
 */

/**
 * Port of legacy `calculateTimeCompact` (blrhikes-webhook-listeners
 * lib/calculateTime.js). Takes a duration in **seconds**, returns e.g.
 * "45 min", "1 hr", "1 hr 31 min", "2 hrs 5 min". Kept verbatim so the
 * legacy app sees identical strings.
 */
export function calculateTimeCompact(time: number): string {
  let minutes = time / 60
  if (Math.floor(minutes) === 1) {
    return Math.floor(minutes) + ' min'
  }
  if (Math.floor(minutes) < 60) {
    return Math.floor(minutes) + ' min'
  } else {
    const hour = Math.floor(minutes) / 60
    minutes %= 60
    if (Math.floor(hour) === 1 && minutes === 0) {
      return Math.floor(hour) + ' hr'
    } else if (Math.floor(hour) === 1 && minutes !== 0) {
      return Math.floor(hour) + ' hr ' + Math.floor(minutes) + ' min'
    } else {
      return Math.floor(hour) + ' hrs ' + Math.floor(minutes) + ' min'
    }
  }
}

export interface ComputedFrontmatterSource {
  /** Trailhead GPS as stored ("lat,lng") */
  gps?: string | null
  /** Trail length in km */
  length?: number | null
  /** Peak (max) elevation in metres, from GPX */
  elevation?: number | null
  /** Elevation gain in metres */
  elevationGain?: number | null
  /** Raw driving distance in km, unrounded (HERE `summary.length / 1000`) */
  computedDrivingDistance?: number | null
  /** Raw driving time in seconds (HERE `summary.duration`) */
  computedDrivingTime?: number | null
  /** Naismith base hiking time, minutes */
  hikingTime?: number | null
  /** Hiking time with rests, minutes (2× base) */
  hikingTimeWithRests?: number | null
  /** Hiking time with rests + exploration, minutes (3× base) */
  hikingTimeWithExploration?: number | null
  /** 8-point compass direction from Bangalore centre */
  relativeLocation?: string | null
}

/**
 * Assemble the legacy `computed*` frontmatter block as YAML key/value lines
 * (no `---` fences — matches the bare frontmatter the legacy app consumes).
 *
 * The driving block is emitted only when the raw HERE values are present; the
 * hiking block only when a hiking time is present. Returns `null` if neither
 * block can be built.
 */
export function buildComputedFrontmatter(
  doc: ComputedFrontmatterSource,
): string | null {
  const lines: string[] = []

  // Source fields — the legacy app expects these alongside the computed* block,
  // with unit suffixes and gps as a single-quoted "lat, lng" string.
  if (doc.gps) {
    const coords = doc.gps
      .split(',')
      .map((p) => p.trim())
      .join(', ')
    lines.push(`gps: '${coords}'`)
  }
  if (doc.length != null) {
    lines.push(`length: ${doc.length} km`)
  }
  if (doc.elevation != null) {
    lines.push(`elevation: ${doc.elevation} m`)
  }
  if (doc.elevationGain != null) {
    lines.push(`elevationGain: ${doc.elevationGain} m`)
  }

  // "Remote" block — driving stats from Bangalore.
  const drivingDistance = doc.computedDrivingDistance
  const drivingTime = doc.computedDrivingTime
  if (drivingDistance != null && drivingTime != null) {
    lines.push(`computedDrivingDistance: ${drivingDistance}`)
    lines.push(`computedDrivingDistanceText: ${Math.round(drivingDistance)} km`)
    lines.push(`computedDrivingTime: ${drivingTime}`)
    lines.push(`computedDrivingTimeText: ${calculateTimeCompact(drivingTime)}`)
    lines.push(`computedRemote: true`)
  }

  // "Local" block — hiking time + relative location.
  const hikingMin = doc.hikingTime
  if (hikingMin != null) {
    const restsMin = doc.hikingTimeWithRests ?? hikingMin * 2
    const explorationMin = doc.hikingTimeWithExploration ?? hikingMin * 3

    const actualHikingTime = hikingMin / 60
    const actualTimeIncludingRests = restsMin / 60
    const actualTimeWithRestAndExploration = explorationMin / 60

    lines.push(`computedActualHikingTime: ${actualHikingTime}`)
    lines.push(`computedActualTimeIncludingRests: ${actualTimeIncludingRests}`)
    lines.push(
      `computedActualTimeWithRestAndExploration: ${actualTimeWithRestAndExploration}`,
    )
    lines.push(`computedRoundedHikingTime: ${Math.ceil(actualHikingTime)}`)
    lines.push(
      `computedRoundedTimeIncludingRests: ${Math.ceil(actualTimeIncludingRests)}`,
    )
    lines.push(
      `computedRoundedTimeWithRestAndExploration: ${Math.ceil(
        actualTimeWithRestAndExploration,
      )}`,
    )
    if (doc.relativeLocation) {
      lines.push(`computedRelativeLocation: ${doc.relativeLocation}`)
    }
    lines.push(`computedLocal: true`)
  }

  return lines.length ? lines.join('\n') : null
}
