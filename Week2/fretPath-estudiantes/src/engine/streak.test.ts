import { describe, expect, it } from 'vitest'
import { computeStreak } from './streak'

// Fixed reference: a local noon, so ±day arithmetic never crosses midnight
// accidentally within a test.
const NOON = new Date(2026, 6, 13, 12, 0, 0).getTime()
const DAY = 24 * 60 * 60 * 1000

describe('computeStreak', () => {
  it('is 0 with no sessions', () => {
    expect(computeStreak([], NOON)).toBe(0)
  })

  it('counts a single session today as 1', () => {
    expect(computeStreak([NOON - 3600_000], NOON)).toBe(1)
  })

  it('counts consecutive days including today', () => {
    expect(computeStreak([NOON, NOON - DAY, NOON - 2 * DAY], NOON)).toBe(3)
  })

  it("stays alive if practiced yesterday but not yet today", () => {
    expect(computeStreak([NOON - DAY, NOON - 2 * DAY], NOON)).toBe(2)
  })

  it('breaks after a full missed day', () => {
    expect(computeStreak([NOON - 2 * DAY, NOON - 3 * DAY], NOON)).toBe(0)
  })

  it('a gap further back limits the streak length', () => {
    // today, yesterday, (gap), 3 days ago
    expect(computeStreak([NOON, NOON - DAY, NOON - 3 * DAY], NOON)).toBe(2)
  })

  it('multiple sessions on one day count once', () => {
    expect(computeStreak([NOON, NOON - 3600_000, NOON - DAY], NOON)).toBe(2)
  })

  it('handles month boundaries', () => {
    const aug1 = new Date(2026, 7, 1, 12).getTime()
    const jul31 = new Date(2026, 6, 31, 12).getTime()
    const jul30 = new Date(2026, 6, 30, 12).getTime()
    expect(computeStreak([aug1, jul31, jul30], aug1)).toBe(3)
  })
})
