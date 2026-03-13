import { describe, it, expect } from 'vitest'
import {
  haversineDistance,
  extractTrailheadFromGpx,
  parseGpsField,
  distanceFromBangaloreCenter,
  parseGpxStats,
  BANGALORE_CENTER,
} from '@/lib/gpx'

describe('haversineDistance', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistance(12.97, 77.59, 12.97, 77.59)).toBe(0)
  })

  it('calculates known distance (Bangalore → Mysore ~128km straight-line)', () => {
    const d = haversineDistance(12.9716, 77.5946, 12.2958, 76.6394)
    expect(d).toBeGreaterThan(120)
    expect(d).toBeLessThan(140)
  })

  it('is symmetric', () => {
    const ab = haversineDistance(12.97, 77.59, 13.08, 77.57)
    const ba = haversineDistance(13.08, 77.57, 12.97, 77.59)
    expect(ab).toBeCloseTo(ba, 10)
  })
})

describe('extractTrailheadFromGpx', () => {
  it('extracts from <wpt> element', () => {
    const gpx = `<?xml version="1.0"?>
      <gpx><wpt lat="12.3456" lon="77.6543"><name>Trailhead</name></wpt></gpx>`
    expect(extractTrailheadFromGpx(gpx)).toEqual({ lat: 12.3456, lng: 77.6543 })
  })

  it('falls back to first <trkpt> when no <wpt>', () => {
    const gpx = `<?xml version="1.0"?>
      <gpx><trk><trkseg>
        <trkpt lat="12.1111" lon="77.2222"><ele>800</ele></trkpt>
        <trkpt lat="12.2222" lon="77.3333"><ele>900</ele></trkpt>
      </trkseg></trk></gpx>`
    expect(extractTrailheadFromGpx(gpx)).toEqual({ lat: 12.1111, lng: 77.2222 })
  })

  it('prefers <wpt> over <trkpt>', () => {
    const gpx = `<?xml version="1.0"?>
      <gpx>
        <wpt lat="12.5" lon="77.5"><name>Start</name></wpt>
        <trk><trkseg><trkpt lat="12.9" lon="77.9"><ele>100</ele></trkpt></trkseg></trk>
      </gpx>`
    expect(extractTrailheadFromGpx(gpx)).toEqual({ lat: 12.5, lng: 77.5 })
  })

  it('returns null for empty GPX', () => {
    expect(extractTrailheadFromGpx('<gpx></gpx>')).toBeNull()
  })

  it('returns null for invalid coordinates', () => {
    const gpx = `<gpx><wpt lat="abc" lon="def"></wpt></gpx>`
    expect(extractTrailheadFromGpx(gpx)).toBeNull()
  })
})

describe('parseGpsField', () => {
  it('parses "lat,lng" string', () => {
    expect(parseGpsField('12.9716,77.5946')).toEqual({ lat: 12.9716, lng: 77.5946 })
  })

  it('handles whitespace', () => {
    expect(parseGpsField('  12.9716,77.5946  ')).toEqual({ lat: 12.9716, lng: 77.5946 })
  })

  it('returns null for single value', () => {
    expect(parseGpsField('12.9716')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseGpsField('')).toBeNull()
  })

  it('returns null for non-numeric values', () => {
    expect(parseGpsField('abc,def')).toBeNull()
  })

  it('returns null for three values', () => {
    expect(parseGpsField('12.97,77.59,800')).toBeNull()
  })
})

describe('distanceFromBangaloreCenter', () => {
  it('returns 0 for Bangalore center itself', () => {
    expect(distanceFromBangaloreCenter(BANGALORE_CENTER)).toBe(0)
  })

  it('returns reasonable distance for Ramanagara (~50km)', () => {
    const d = distanceFromBangaloreCenter({ lat: 12.7266, lng: 77.2810 })
    expect(d).toBeGreaterThan(35)
    expect(d).toBeLessThan(65)
  })

  it('rounds to one decimal place', () => {
    const d = distanceFromBangaloreCenter({ lat: 13.0, lng: 77.6 })
    const decimals = d.toString().split('.')[1]
    expect(!decimals || decimals.length <= 1).toBe(true)
  })
})

describe('parseGpxStats', () => {
  const makeGpx = (points: { lat: number; lng: number; ele: number }[]) => {
    const trkpts = points
      .map((p) => `<trkpt lat="${p.lat}" lon="${p.lng}"><ele>${p.ele}</ele></trkpt>`)
      .join('\n')
    return `<gpx><trk><trkseg>${trkpts}</trkseg></trk></gpx>`
  }

  it('returns null for empty GPX', () => {
    expect(parseGpxStats('<gpx></gpx>')).toBeNull()
  })

  it('returns null for single trackpoint', () => {
    const gpx = makeGpx([{ lat: 12.97, lng: 77.59, ele: 800 }])
    expect(parseGpxStats(gpx)).toBeNull()
  })

  it('calculates stats for a simple uphill track', () => {
    const gpx = makeGpx([
      { lat: 12.9700, lng: 77.5900, ele: 800 },
      { lat: 12.9750, lng: 77.5900, ele: 850 },
      { lat: 12.9800, lng: 77.5900, ele: 900 },
    ])
    const stats = parseGpxStats(gpx)
    expect(stats).not.toBeNull()
    expect(stats!.length).toBeGreaterThan(0)
    expect(stats!.elevationGain).toBe(100) // 50 + 50, rounded to nearest 5
    expect(stats!.hikingTime).toBeGreaterThan(0)
    expect(stats!.hikingTimeWithRests).toBe(Math.round(stats!.hikingTime * 1.2))
  })

  it('ignores negative elevation changes (descent)', () => {
    const gpx = makeGpx([
      { lat: 12.9700, lng: 77.5900, ele: 900 },
      { lat: 12.9750, lng: 77.5900, ele: 850 },
      { lat: 12.9800, lng: 77.5900, ele: 800 },
    ])
    const stats = parseGpxStats(gpx)
    expect(stats).not.toBeNull()
    expect(stats!.elevationGain).toBe(0)
  })

  it('rounds elevation gain to nearest 5m', () => {
    const gpx = makeGpx([
      { lat: 12.9700, lng: 77.5900, ele: 800 },
      { lat: 12.9750, lng: 77.5900, ele: 813 }, // +13m gain
    ])
    const stats = parseGpxStats(gpx)
    expect(stats!.elevationGain).toBe(15) // 13 rounded to nearest 5
  })

  it('rounds trail length to 1 decimal place', () => {
    const gpx = makeGpx([
      { lat: 12.9700, lng: 77.5900, ele: 800 },
      { lat: 12.9800, lng: 77.5900, ele: 800 },
    ])
    const stats = parseGpxStats(gpx)
    const decimals = stats!.length.toString().split('.')[1]
    expect(!decimals || decimals.length <= 1).toBe(true)
  })

  it('handles trackpoints without elevation data', () => {
    const gpx = `<gpx><trk><trkseg>
      <trkpt lat="12.97" lon="77.59"></trkpt>
      <trkpt lat="12.98" lon="77.59"></trkpt>
    </trkseg></trk></gpx>`
    const stats = parseGpxStats(gpx)
    expect(stats).not.toBeNull()
    expect(stats!.length).toBeGreaterThan(0)
    expect(stats!.elevationGain).toBe(0)
  })
})
