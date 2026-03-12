/** Center of Bangalore (Cubbon Park) */
export const BANGALORE_CENTER = { lat: 12.9763, lng: 77.5929 }

export interface GpxStats {
  /** Total trail distance in km, rounded to 1 decimal */
  length: number
  /** Cumulative elevation gain in metres, rounded to nearest 5m */
  elevationGain: number
  /** Estimated hiking time in minutes (Naismith's rule, one-way) */
  hikingTime: number
  /** Estimated hiking time with rests (+20%) in minutes */
  hikingTimeWithRests: number
}

/**
 * Straight-line distance between two GPS coordinates using the Haversine formula.
 * @returns Distance in kilometres
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Extract trailhead coordinates from GPX XML content.
 * Tries explicit waypoints (<wpt>) first, then falls back to the first
 * track point (<trkpt>) which is the start of the route.
 */
export function extractTrailheadFromGpx(
  gpxContent: string,
): { lat: number; lng: number } | null {
  // <wpt lat="12.34" lon="77.56"> — explicit trailhead/waypoint
  const wptMatch = gpxContent.match(/<wpt\s[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"/)
  if (wptMatch) {
    const lat = parseFloat(wptMatch[1])
    const lng = parseFloat(wptMatch[2])
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng }
  }

  // <trkpt lat="12.34" lon="77.56"> — first point of the recorded track
  const trkptMatch = gpxContent.match(/<trkpt\s[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"/)
  if (trkptMatch) {
    const lat = parseFloat(trkptMatch[1])
    const lng = parseFloat(trkptMatch[2])
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng }
  }

  return null
}

/**
 * Parse the gps text field ("lat,lng" format) into coordinates.
 */
export function parseGpsField(gps: string): { lat: number; lng: number } | null {
  const parts = gps.trim().split(',')
  if (parts.length !== 2) return null
  const lat = parseFloat(parts[0])
  const lng = parseFloat(parts[1])
  if (isNaN(lat) || isNaN(lng)) return null
  return { lat, lng }
}

/**
 * Straight-line distance from Bangalore center to the given trailhead, in km.
 * Rounded to one decimal place.
 */
export function distanceFromBangaloreCenter(trailhead: {
  lat: number
  lng: number
}): number {
  const raw = haversineDistance(
    BANGALORE_CENTER.lat,
    BANGALORE_CENTER.lng,
    trailhead.lat,
    trailhead.lng,
  )
  return Math.round(raw * 10) / 10
}

/**
 * Parse hiking stats from GPX XML content.
 *
 * Calculates:
 * - Total trail distance (sum of Haversine between consecutive trackpoints)
 * - Elevation gain (sum of positive ele deltas)
 * - Hiking time via Naismith's rule: 1hr/5km + 1hr/600m gain
 *
 * Returns null if no trackpoints found.
 */
export function parseGpxStats(gpxContent: string): GpxStats | null {
  // Extract all <trkpt lat="..." lon="...">...<ele>...</ele>...</trkpt> blocks
  const trkptRegex = /<trkpt\s[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g
  const eleRegex = /<ele>([^<]+)<\/ele>/

  interface Point { lat: number; lng: number; ele: number | null }
  const points: Point[] = []

  let match: RegExpExecArray | null
  while ((match = trkptRegex.exec(gpxContent)) !== null) {
    const lat = parseFloat(match[1])
    const lng = parseFloat(match[2])
    if (isNaN(lat) || isNaN(lng)) continue

    const eleMatch = eleRegex.exec(match[3])
    const ele = eleMatch ? parseFloat(eleMatch[1]) : null

    points.push({ lat, lng, ele: ele !== null && !isNaN(ele) ? ele : null })
  }

  if (points.length < 2) return null

  let totalDistance = 0
  let totalElevationGain = 0

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]

    totalDistance += haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng)

    if (prev.ele !== null && curr.ele !== null) {
      const delta = curr.ele - prev.ele
      if (delta > 0) totalElevationGain += delta
    }
  }

  // Naismith's rule: time (hrs) = distance/5 + elevationGain/600
  const hikingHours = totalDistance / 5 + totalElevationGain / 600
  const hikingTime = Math.round(hikingHours * 60)
  const hikingTimeWithRests = Math.round(hikingTime * 1.2)

  return {
    length: Math.round(totalDistance * 10) / 10,
    elevationGain: Math.round(totalElevationGain / 5) * 5, // round to nearest 5m
    hikingTime,
    hikingTimeWithRests,
  }
}
