/**
 * HERE Routing API v8 — driving distance + time from Bangalore to a trailhead.
 * Docs: https://developer.here.com/documentation/routing-api/dev_guide/topics/use-cases/route-from-a-to-b.html
 *
 * Env var required: HERE_API_KEY
 */

import { BANGALORE_CENTER } from './gpx'

interface HereRoute {
  routes: Array<{
    sections: Array<{
      summary: {
        duration: number  // seconds
        length: number    // metres
      }
    }>
  }>
}

export interface DrivingInfo {
  /** Driving distance in km (rounded to 1 decimal) */
  drivingDistance: number
  /** Human-readable distance, e.g. "87.3 km" */
  drivingDistanceText: string
  /** Driving time in minutes (rounded) */
  drivingTime: number
  /** Human-readable duration, e.g. "1h 45min" */
  drivingTimeText: string
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

async function fetchRouteSummary(
  trailhead: { lat: number; lng: number },
  routingMode: 'fast' | 'short',
): Promise<{ length: number; duration: number } | null> {
  const apiKey = process.env.HERE_API_KEY
  if (!apiKey) {
    console.warn('HERE_API_KEY not set — skipping driving info calculation')
    return null
  }

  const url = new URL('https://router.hereapi.com/v8/routes')
  url.searchParams.set('transportMode', 'car')
  url.searchParams.set('routingMode', routingMode)
  url.searchParams.set('origin', `${BANGALORE_CENTER.lat},${BANGALORE_CENTER.lng}`)
  url.searchParams.set('destination', `${trailhead.lat},${trailhead.lng}`)
  url.searchParams.set('return', 'summary')
  url.searchParams.set('apikey', apiKey)

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`HERE API error: ${response.status} ${await response.text()}`)
  }

  const data = (await response.json()) as HereRoute
  return data.routes?.[0]?.sections?.[0]?.summary ?? null
}

/**
 * Fetch driving distance and time from Bangalore centre to the given trailhead
 * using the HERE Routing API v8. Uses the **fastest** route (HERE's default).
 *
 * Returns null if the API key is missing or the request fails.
 */
export async function getDrivingInfoFromBangalore(trailhead: {
  lat: number
  lng: number
}): Promise<DrivingInfo | null> {
  const summary = await fetchRouteSummary(trailhead, 'fast')
  if (!summary) return null

  const drivingDistance = Math.round((summary.length / 1000) * 10) / 10 // metres → km, 1dp
  const drivingTime = Math.round(summary.duration / 60) // seconds → minutes

  return {
    drivingDistance,
    drivingDistanceText: `${drivingDistance} km`,
    drivingTime,
    drivingTimeText: formatDuration(drivingTime),
  }
}

/**
 * Shortest road distance (km, 1 decimal) from Bangalore centre to the trailhead
 * via the HERE Routing API's `routingMode=short` — the geographically shortest
 * path, which may differ from the fastest route.
 *
 * Returns null if the API key is missing or the request fails.
 */
export async function getShortestRoadDistanceFromBangalore(trailhead: {
  lat: number
  lng: number
}): Promise<number | null> {
  const summary = await fetchRouteSummary(trailhead, 'short')
  if (!summary) return null
  return Math.round((summary.length / 1000) * 10) / 10
}
