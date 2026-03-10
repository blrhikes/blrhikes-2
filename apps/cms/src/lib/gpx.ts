/** Center of Bangalore (Brigade Road / MG Road area) */
export const BANGALORE_CENTER = { lat: 12.9716, lng: 77.5946 }

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
