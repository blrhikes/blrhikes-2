import { DOMParser } from '@xmldom/xmldom'
import { gpx as gpxToGeoJson } from '@tmcw/togeojson'

/** Center of Bangalore (Cubbon Park) */
export const BANGALORE_CENTER = { lat: 12.9763, lng: 77.5929 }

export interface GpxStats {
  /** Total trail distance in km, rounded to 1 decimal */
  length: number
  /** Cumulative elevation gain in metres, rounded to nearest 5m */
  elevationGain: number
  /** Peak (maximum) elevation in metres, rounded to nearest metre */
  peakElevation: number | null
  /** Estimated hiking time in minutes (Naismith's rule, one-way) */
  hikingTime: number
  /** Estimated hiking time with rests in minutes (2x base) */
  hikingTimeWithRests: number
  /** Estimated hiking time with rests + exploration in minutes (3x base) */
  hikingTimeWithExploration: number
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

/** Parse GPX XML into a GeoJSON FeatureCollection via @tmcw/togeojson. */
function parseGpx(gpxContent: string) {
  const doc = new DOMParser().parseFromString(gpxContent, 'text/xml')
  return gpxToGeoJson(doc as unknown as Document)
}

interface Point { lat: number; lng: number; ele: number | null }

/** Flatten all track points (including MultiLineString segments) into a single list. */
function collectTrackPoints(fc: ReturnType<typeof parseGpx>): Point[] {
  const points: Point[] = []
  for (const feature of fc.features) {
    const geom = feature.geometry
    if (!geom) continue
    const lines: number[][][] =
      geom.type === 'LineString'
        ? [geom.coordinates as number[][]]
        : geom.type === 'MultiLineString'
        ? (geom.coordinates as number[][][])
        : []
    for (const line of lines) {
      for (const coord of line) {
        const [lng, lat, ele] = coord
        if (typeof lat !== 'number' || typeof lng !== 'number') continue
        points.push({ lat, lng, ele: typeof ele === 'number' ? ele : null })
      }
    }
  }
  return points
}

/**
 * Extract trailhead coordinates from GPX XML content.
 *
 * Prefers the **first point of the recorded track** (the actual start of the hike).
 * Falls back to the first waypoint only if the file has no track — waypoints in
 * real-world exports (Gaia, Garmin, etc.) are typically POIs (shrine, hilltop,
 * cave, etc.) rather than the trailhead.
 */
export function extractTrailheadFromGpx(
  gpxContent: string,
): { lat: number; lng: number } | null {
  let fc: ReturnType<typeof parseGpx>
  try {
    fc = parseGpx(gpxContent)
  } catch {
    return null
  }

  const points = collectTrackPoints(fc)
  if (points.length > 0) return { lat: points[0].lat, lng: points[0].lng }

  for (const feature of fc.features) {
    if (feature.geometry?.type === 'Point') {
      const [lng, lat] = feature.geometry.coordinates as number[]
      if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng }
    }
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

export type CompassDirection =
  | 'north'
  | 'northeast'
  | 'east'
  | 'southeast'
  | 'south'
  | 'southwest'
  | 'west'
  | 'northwest'

/**
 * 8-point compass direction from Bangalore center to the given trailhead.
 * Ports the legacy webhook-listeners getRelativeLocation.js logic:
 *   angle = atan2(dLng, dLat), bucketed into 45° arcs starting at north.
 * Bangalore-centric, so it's fine to use flat (dLat, dLng) math — Mercator
 * distortion is negligible at these distances (< 150 km).
 */
export function getRelativeLocationFromBangalore(trailhead: {
  lat: number
  lng: number
}): CompassDirection | null {
  const dLat = trailhead.lat - BANGALORE_CENTER.lat
  const dLng = trailhead.lng - BANGALORE_CENTER.lng
  if (dLat === 0 && dLng === 0) return null

  const deg = (Math.atan2(dLng, dLat) * 180) / Math.PI

  if (deg > -22.5 && deg <= 22.5) return 'north'
  if (deg > 22.5 && deg <= 67.5) return 'northeast'
  if (deg > 67.5 && deg <= 112.5) return 'east'
  if (deg > 112.5 && deg <= 157.5) return 'southeast'
  if (deg > 157.5 || deg <= -157.5) return 'south'
  if (deg > -157.5 && deg <= -112.5) return 'southwest'
  if (deg > -112.5 && deg <= -67.5) return 'west'
  if (deg > -67.5 && deg <= -22.5) return 'northwest'
  return null
}

/**
 * Parse hiking stats from GPX XML content.
 *
 * Calculates:
 * - Total trail distance (sum of Haversine between consecutive trackpoints)
 * - Elevation gain (sum of positive ele deltas)
 * - Peak elevation
 * - Hiking time via Naismith's rule: 1hr/5km + 1hr/600m gain
 * - hikingTimeWithRests = 2x base, hikingTimeWithExploration = 3x base
 *   (matches legacy blrhikes-webhook-listeners/lib/timeOnTrail.js)
 *
 * Returns null if fewer than 2 trackpoints found.
 */
export function parseGpxStats(gpxContent: string): GpxStats | null {
  let fc: ReturnType<typeof parseGpx>
  try {
    fc = parseGpx(gpxContent)
  } catch {
    return null
  }

  const points = collectTrackPoints(fc)
  if (points.length < 2) return null

  let totalDistance = 0
  let totalElevationGain = 0
  let peakElevation: number | null = points[0].ele

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]

    totalDistance += haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng)

    if (prev.ele !== null && curr.ele !== null) {
      const delta = curr.ele - prev.ele
      if (delta > 0) totalElevationGain += delta
    }

    if (curr.ele !== null && (peakElevation === null || curr.ele > peakElevation)) {
      peakElevation = curr.ele
    }
  }

  // Naismith's rule: time (hrs) = distance/5 + elevationGain/600
  const hikingHours = totalDistance / 5 + totalElevationGain / 600
  const hikingTime = Math.round(hikingHours * 60)

  return {
    length: Math.round(totalDistance * 10) / 10,
    elevationGain: Math.round(totalElevationGain / 5) * 5, // round to nearest 5m
    peakElevation: peakElevation !== null ? Math.round(peakElevation) : null,
    hikingTime,
    hikingTimeWithRests: hikingTime * 2,
    hikingTimeWithExploration: hikingTime * 3,
  }
}
