import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getDrivingInfoFromBangalore } from '@/lib/driving'

describe('getDrivingInfoFromBangalore', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns null when HERE_API_KEY is not set', async () => {
    delete process.env.HERE_API_KEY
    const result = await getDrivingInfoFromBangalore({ lat: 12.7266, lng: 77.2810 })
    expect(result).toBeNull()
  })

  it('returns driving info on successful API response', async () => {
    process.env.HERE_API_KEY = 'test-key'

    const mockResponse = {
      routes: [{
        sections: [{
          summary: {
            duration: 5400,  // 90 minutes
            length: 87300,   // 87.3 km
          },
        }],
      }],
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await getDrivingInfoFromBangalore({ lat: 12.7266, lng: 77.2810 })

    expect(result).toEqual({
      drivingDistance: 87.3,
      drivingDistanceText: '87.3 km',
      drivingTime: 90,
      drivingTimeText: '1h 30min',
    })
  })

  it('throws on non-OK API response', async () => {
    process.env.HERE_API_KEY = 'test-key'

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as Response)

    await expect(
      getDrivingInfoFromBangalore({ lat: 12.7266, lng: 77.2810 }),
    ).rejects.toThrow('HERE API error: 401')
  })

  it('returns null when API returns no routes', async () => {
    process.env.HERE_API_KEY = 'test-key'

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ routes: [] }),
    } as Response)

    const result = await getDrivingInfoFromBangalore({ lat: 12.7266, lng: 77.2810 })
    expect(result).toBeNull()
  })

  it('formats duration correctly for hours only', async () => {
    process.env.HERE_API_KEY = 'test-key'

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [{ sections: [{ summary: { duration: 7200, length: 120000 } }] }],
      }),
    } as Response)

    const result = await getDrivingInfoFromBangalore({ lat: 12.0, lng: 77.0 })
    expect(result!.drivingTimeText).toBe('2h')
  })

  it('formats duration correctly for minutes only', async () => {
    process.env.HERE_API_KEY = 'test-key'

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [{ sections: [{ summary: { duration: 2700, length: 40000 } }] }],
      }),
    } as Response)

    const result = await getDrivingInfoFromBangalore({ lat: 12.8, lng: 77.5 })
    expect(result!.drivingTimeText).toBe('45min')
  })

  it('passes correct query params to HERE API', async () => {
    process.env.HERE_API_KEY = 'my-secret-key'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ routes: [{ sections: [{ summary: { duration: 3600, length: 50000 } }] }] }),
    } as Response)

    await getDrivingInfoFromBangalore({ lat: 12.5, lng: 77.3 })

    const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string)
    expect(calledUrl.origin + calledUrl.pathname).toBe('https://router.hereapi.com/v8/routes')
    expect(calledUrl.searchParams.get('transportMode')).toBe('car')
    expect(calledUrl.searchParams.get('origin')).toBe('12.9716,77.5946')
    expect(calledUrl.searchParams.get('destination')).toBe('12.5,77.3')
    expect(calledUrl.searchParams.get('return')).toBe('summary')
    expect(calledUrl.searchParams.get('apikey')).toBe('my-secret-key')
  })
})
