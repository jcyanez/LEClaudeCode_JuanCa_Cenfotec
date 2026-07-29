import { describe, expect, it } from 'vitest'
import {
  applyReset,
  compareStates,
  mergeItemState,
  shouldReplace,
} from './merge'
import type { UserItemState } from '../engine/types'

/**
 * The merge rule is verified by EXHAUSTIVE enumeration of the stamp space,
 * not sampling: 3 lastReviewed × 3 updatedAt × 3 deviceId = 27 distinct
 * stamp shapes, every pair (729) and every triple (19,683) checked. If these
 * pass, convergence is a theorem for this implementation, not a hope.
 * (the sync design (§2); the SQL RPC must match this file.)
 */

function state(
  index: number,
  lastReviewed: number | null,
  updatedAt: number | undefined,
  deviceId: string | undefined,
): UserItemState {
  return {
    itemId: 'X-1',
    easiness: 2.5,
    interval: 6,
    repetitions: index, // distinct content so winner identity is observable
    mastery: index,
    bestBpm: null,
    dueDate: lastReviewed === null ? null : lastReviewed + 86_400_000,
    lastReviewed,
    ...(updatedAt !== undefined ? { updatedAt } : {}),
    ...(deviceId !== undefined ? { deviceId } : {}),
  }
}

const REVIEWED = [null, 100, 200] as const
const UPDATED = [undefined, 100, 200] as const
const DEVICES = [undefined, 'a', 'b'] as const

const ALL: UserItemState[] = []
{
  let i = 0
  for (const r of REVIEWED) {
    for (const u of UPDATED) {
      for (const d of DEVICES) ALL.push(state(i++, r, u, d))
    }
  }
}

describe('mergeItemState — algebraic properties (exhaustive)', () => {
  it('is idempotent: merge(s, s) = s', () => {
    for (const s of ALL) {
      expect(mergeItemState(s, s)).toEqual(s)
    }
  })

  it('is commutative: merge(a, b) = merge(b, a) for all 729 pairs', () => {
    for (const a of ALL) {
      for (const b of ALL) {
        expect(mergeItemState(a, b)).toEqual(mergeItemState(b, a))
      }
    }
  })

  it('is associative: all 19,683 triples converge to the same winner', () => {
    for (const a of ALL) {
      for (const b of ALL) {
        for (const c of ALL) {
          const left = mergeItemState(mergeItemState(a, b), c)
          const right = mergeItemState(a, mergeItemState(b, c))
          expect(left).toEqual(right)
        }
      }
    }
  })

  it('always returns one of its inputs (never invents a state)', () => {
    for (const a of ALL) {
      for (const b of ALL) {
        const winner = mergeItemState(a, b)
        expect(winner === a || winner === b).toBe(true)
      }
    }
  })
})

describe('compareStates — the rule itself', () => {
  it('rule 1: a later review beats everything else', () => {
    const older = state(0, 100, 999_999, 'z')
    const newer = state(1, 200, 0, undefined)
    expect(shouldReplace(newer, older)).toBe(true)
    expect(shouldReplace(older, newer)).toBe(false)
  })

  it('never-reviewed (null) loses to any review', () => {
    const never = state(0, null, 999_999, 'z')
    const once = state(1, 1, undefined, undefined)
    expect(shouldReplace(once, never)).toBe(true)
  })

  it('rule 2: review tie → later updatedAt wins (skewed-clock case)', () => {
    // Two devices, same lastReviewed stamp, different write clocks.
    const a = state(0, 100, 500, 'a')
    const b = state(1, 100, 600, 'a')
    expect(mergeItemState(a, b)).toEqual(b)
  })

  it('rule 3: full stamp tie → larger deviceId wins deterministically', () => {
    const a = state(0, 100, 500, 'device-aaa')
    const b = state(1, 100, 500, 'device-bbb')
    expect(mergeItemState(a, b)).toEqual(b)
    expect(mergeItemState(b, a)).toEqual(b)
  })

  it('rule 4: identical stamps, divergent content → deterministic winner', () => {
    const a = state(0, 100, 500, 'same')
    const b = state(1, 100, 500, 'same')
    expect(mergeItemState(a, b)).toEqual(mergeItemState(b, a))
  })

  it('identical states compare as 0 and never churn a write', () => {
    for (const s of ALL) {
      expect(compareStates(s, { ...s })).toBe(0)
      expect(shouldReplace({ ...s }, s)).toBe(false)
    }
  })
})

describe('applyReset — the watermark (§4.3)', () => {
  const reviewedBefore = state(0, 100, 100, 'a')
  const reviewedAfter = state(1, 300, 300, 'a')
  const neverReviewed = state(2, null, undefined, undefined)

  it('discards states reviewed before the reset, keeps ones after', () => {
    const discard = applyReset([reviewedBefore, reviewedAfter], 200)
    expect(discard).toEqual([reviewedBefore.itemId])
  })

  it('a review exactly at the reset instant survives (>= boundary)', () => {
    expect(applyReset([state(0, 200, 200, 'a')], 200)).toEqual([])
  })

  it('never-reviewed states die on reset (they predate everything)', () => {
    expect(applyReset([neverReviewed], 1)).toEqual([neverReviewed.itemId])
  })

  it('offline reviews on another device made AFTER the reset survive it', () => {
    // Device A resets at t=200; device B, offline, reviewed at t=250.
    // When B syncs, its post-reset knowledge must not be destroyed.
    const bOffline = state(0, 250, 250, 'b')
    expect(applyReset([bOffline], 200)).toEqual([])
  })
})
