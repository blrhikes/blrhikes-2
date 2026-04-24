import { describe, it, expect } from 'vitest'
import { roundToHours, formatHikingTimeRange } from '@blrhikes/shared'

describe('roundToHours', () => {
  it('rounds 60 minutes to 1 hour', () => {
    expect(roundToHours(60)).toBe(1)
  })

  it('rounds 105 minutes (1h 45m) up to 2 hours', () => {
    expect(roundToHours(105)).toBe(2)
  })

  it('rounds 89 minutes down to 1 hour', () => {
    expect(roundToHours(89)).toBe(1)
  })

  it('rounds 90 minutes up to 2 hours (banker-tie goes up)', () => {
    // Math.round(1.5) → 2 in JS
    expect(roundToHours(90)).toBe(2)
  })

  it('rounds 165 minutes (2h 45m) up to 3 hours', () => {
    expect(roundToHours(165)).toBe(3)
  })

  it('floors to 1 hour for very small values (sub-30min)', () => {
    expect(roundToHours(0)).toBe(1)
    expect(roundToHours(5)).toBe(1)
    expect(roundToHours(29)).toBe(1)
  })

  it('also floors to 1 hour for values that would round to 0', () => {
    // 15min → Math.round(0.25) = 0; floor kicks in
    expect(roundToHours(15)).toBe(1)
  })

  it('handles large values', () => {
    expect(roundToHours(600)).toBe(10) // 10h
    expect(roundToHours(725)).toBe(12) // 12h 5min
  })
})

describe('formatHikingTimeRange', () => {
  it('renders a range when endpoints round to different hours', () => {
    expect(formatHikingTimeRange(105, 165)).toBe('2-3 hours')
  })

  it('renders a range for wider spans', () => {
    expect(formatHikingTimeRange(180, 360)).toBe('3-6 hours')
  })

  it('collapses to a single value with plural when both round equal (>=2h)', () => {
    expect(formatHikingTimeRange(170, 190)).toBe('3 hours')
  })

  it('collapses to singular "1 hour" when both round to 1', () => {
    expect(formatHikingTimeRange(45, 70)).toBe('1 hour')
  })

  it('handles zero endpoints via the 1-hour floor', () => {
    // Both round up to 1h via the floor; range collapses.
    expect(formatHikingTimeRange(0, 20)).toBe('1 hour')
  })

  it('orders arguments as passed (no auto-swap)', () => {
    // Defensive: callers are expected to pass lower first. The formatter
    // should not silently re-order — if someone passes them reversed it
    // will render nonsense like "3-2 hours", which is a caller bug.
    expect(formatHikingTimeRange(180, 120)).toBe('3-2 hours')
  })
})
