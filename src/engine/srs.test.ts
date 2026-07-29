import { describe, expect, it } from 'vitest'
import {
  applyAttempt,
  applyDrillAttempt,
  applyGateAttempt,
  currentMastery,
  DAY_MS,
  DEFAULT_EASINESS,
  initialItemState,
  isDue,
  isNew,
  ITEM_MASTERY_TARGET,
} from './srs'
import type { UserItemState } from './types'

const T0 = 1_750_000_000_000 // fixed "now" for determinism

describe('initialItemState', () => {
  it('starts with SM-2 defaults and no history', () => {
    const s = initialItemState('X-1')
    expect(s).toEqual({
      itemId: 'X-1',
      easiness: DEFAULT_EASINESS,
      interval: 0,
      repetitions: 0,
      mastery: 0,
      bestBpm: null,
      dueDate: null,
      lastReviewed: null,
    })
    expect(isNew(s)).toBe(true)
    expect(isDue(s, T0)).toBe(false)
  })

  it('treats undefined state as new', () => {
    expect(isNew(undefined)).toBe(true)
  })
})

describe('currentMastery — overdue decay', () => {
  const reviewed: UserItemState = {
    itemId: 'X-1',
    easiness: 2.5,
    interval: 6,
    repetitions: 2,
    mastery: 80,
    bestBpm: null,
    dueDate: T0,
    lastReviewed: T0 - 6 * DAY_MS,
  }

  it('does not decay before the due date', () => {
    expect(currentMastery(reviewed, T0 - DAY_MS)).toBe(80)
    expect(currentMastery(reviewed, T0)).toBe(80)
  })

  it('decays 3% per overdue day, compounding', () => {
    expect(currentMastery(reviewed, T0 + DAY_MS)).toBeCloseTo(80 * 0.97, 6)
    expect(currentMastery(reviewed, T0 + 10 * DAY_MS)).toBeCloseTo(
      80 * Math.pow(0.97, 10),
      6,
    )
  })

  it('never-reviewed items have no decay (mastery stays 0)', () => {
    expect(currentMastery(initialItemState('X-1'), T0)).toBe(0)
  })
})

describe('isDue', () => {
  it('is due exactly at and after the due date, not before', () => {
    const s = applyGateAttempt(initialItemState('X-1'), true, T0) // due T0 + 1 day
    expect(isDue(s, T0 + DAY_MS - 1)).toBe(false)
    expect(isDue(s, T0 + DAY_MS)).toBe(true)
    expect(isDue(s, T0 + 2 * DAY_MS)).toBe(true)
  })
})

describe('applyDrillAttempt — metronome-graded drills', () => {
  it('derives mastery from best ÷ target (target tempo → 100)', () => {
    const s = applyDrillAttempt(initialItemState('D-1'), 120, 120, T0)
    expect(s.bestBpm).toBe(120)
    expect(s.mastery).toBe(100)
    expect(s.lastReviewed).toBe(T0)
  })

  it('one clean run at 80% of target already masters (no grind)', () => {
    const s = applyDrillAttempt(initialItemState('D-1'), 96, 120, T0)
    expect(s.mastery).toBe(80)
    expect(s.mastery).toBeGreaterThanOrEqual(ITEM_MASTERY_TARGET)
  })

  it('keeps bestBpm monotonic — a slower session never lowers it', () => {
    let s = applyDrillAttempt(initialItemState('D-1'), 100, 120, T0)
    expect(s.bestBpm).toBe(100)
    s = applyDrillAttempt(s, 70, 120, T0 + DAY_MS)
    expect(s.bestBpm).toBe(100) // still your best
    expect(s.mastery).toBe(Math.round((100 * 100) / 120)) // 83
  })

  it('below target keeps it in near rotation (1-day) with no penalty', () => {
    const s = applyDrillAttempt(initialItemState('D-1'), 60, 120, T0)
    expect(s.mastery).toBe(50)
    expect(s.repetitions).toBe(0)
    expect(s.interval).toBe(1)
    expect(s.dueDate).toBe(T0 + DAY_MS)
  })

  it('at/above the mastery target grows the interval (light spaced review)', () => {
    let s = applyDrillAttempt(initialItemState('D-1'), 120, 120, T0)
    expect(s.repetitions).toBe(1)
    expect(s.interval).toBe(1)
    s = applyDrillAttempt(s, 120, 120, s.dueDate!)
    expect(s.repetitions).toBe(2)
    expect(s.interval).toBe(6)
    s = applyDrillAttempt(s, 120, 120, s.dueDate!)
    expect(s.repetitions).toBe(3)
    expect(s.interval).toBe(Math.round(6 * DEFAULT_EASINESS)) // 15
  })

  it('caps mastery at 100 when best exceeds target', () => {
    const s = applyDrillAttempt(initialItemState('D-1'), 200, 120, T0)
    expect(s.mastery).toBe(100)
    expect(s.bestBpm).toBe(200)
  })

  it('rejects a non-positive target or negative bpm', () => {
    expect(() => applyDrillAttempt(initialItemState('D-1'), 100, 0, T0)).toThrow(
      RangeError,
    )
    expect(() => applyDrillAttempt(initialItemState('D-1'), -5, 120, T0)).toThrow(
      RangeError,
    )
  })

  it('does not mutate the input state', () => {
    const s = initialItemState('D-1')
    const frozen = JSON.stringify(s)
    applyDrillAttempt(s, 120, 120, T0)
    expect(JSON.stringify(s)).toBe(frozen)
  })
})

describe('applyGateAttempt — understanding checks', () => {
  it('"Got it" masters the item and never records a bpm', () => {
    const s = applyGateAttempt(initialItemState('G-1'), true, T0)
    expect(s.mastery).toBe(100)
    expect(s.bestBpm).toBeNull()
    expect(s.repetitions).toBe(1)
    expect(s.interval).toBe(1)
  })

  it('"Not yet" resurfaces next session with no penalty', () => {
    const base: UserItemState = { ...initialItemState('G-1'), mastery: 40 }
    const s = applyGateAttempt(base, false, T0)
    expect(s.mastery).toBe(40) // unchanged — never punished
    expect(s.repetitions).toBe(0)
    expect(s.interval).toBe(1)
    expect(s.dueDate).toBe(T0 + DAY_MS)
  })

  it('repeated "Got it" grows the interval toward a light cadence', () => {
    let s = applyGateAttempt(initialItemState('G-1'), true, T0)
    s = applyGateAttempt(s, true, s.dueDate!)
    expect(s.interval).toBe(6)
  })
})

describe('applyAttempt — dispatch boundary', () => {
  it('routes gate results to the gate path', () => {
    const s = applyAttempt(initialItemState('G-1'), { kind: 'gate', got: true }, T0)
    expect(s.mastery).toBe(100)
    expect(s.bestBpm).toBeNull()
  })

  it('routes drill results to the drill path', () => {
    const s = applyAttempt(
      initialItemState('D-1'),
      { kind: 'drill', bpm: 120, targetBpm: 120 },
      T0,
    )
    expect(s.bestBpm).toBe(120)
    expect(s.mastery).toBe(100)
  })
})

describe('drill mastery still decays when overdue (light-review pressure)', () => {
  it('a mastered drill reads lower once overdue, then re-masters on review', () => {
    const s = applyDrillAttempt(initialItemState('D-1'), 120, 120, T0)
    // Mastered now; interval 1 day → overdue after that.
    expect(currentMastery(s, s.dueDate! + 10 * DAY_MS)).toBeLessThan(100)
    // Re-drilling at best re-derives full mastery from the retained record.
    const again = applyDrillAttempt(s, 110, 120, s.dueDate! + 10 * DAY_MS)
    expect(again.mastery).toBe(100)
  })
})
