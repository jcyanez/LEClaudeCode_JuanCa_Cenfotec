/**
 * Engine A — SRS scheduler.
 *
 * A modified SM-2 (Anki-style), generalized from "recall a fact" to "perform a
 * skill". Pure functions over UserItemState; the caller supplies `now` so the
 * engine is deterministic and fully unit-testable.
 *
 * Attempts come in two kinds (`applyAttempt`), never a raw 0–5 grade:
 * - Drill (`applyDrillAttempt`) → best clean tempo drives mastery
 *   (`round(100 × bestBpm / targetBpm)`); at/above the target it schedules a
 *   light review SM-2 style, below it stays in near rotation with no penalty.
 * - Gate (`applyGateAttempt`) → "Got it" masters (100) + light review;
 *   "Not yet" resurfaces next session, unchanged.
 *
 * Mastery model:
 * - Mastery is 0–100, derived (not accumulated), so one clean run at target
 *   masters a drill — no rep-grind.
 * - Overdue decay is exponential: 3% of current mastery per overdue day,
 *   computed on read via `currentMastery` (state itself is not mutated by the
 *   passage of time) — a rusty drill reads below target and resurfaces.
 * - `easiness` is retained as the SM-2 interval multiplier but is no longer
 *   nudged per attempt (the ladder/gate is its own quality signal).
 */

import type { AttemptResult, UserItemState } from './types'

export const DAY_MS = 24 * 60 * 60 * 1000

/** SM-2 interval multiplier. Retained for scheduling; never nudged per attempt. */
export const DEFAULT_EASINESS = 2.5

/** An item counts toward node mastery once its mastery reaches this. */
export const ITEM_MASTERY_TARGET = 80

/** Multiplicative daily retention once an item is overdue (3%/day decay). */
export const OVERDUE_RETENTION_PER_DAY = 0.97

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function initialItemState(itemId: string): UserItemState {
  return {
    itemId,
    easiness: DEFAULT_EASINESS,
    interval: 0,
    repetitions: 0,
    mastery: 0,
    bestBpm: null,
    dueDate: null,
    lastReviewed: null,
  }
}

/**
 * Decay-adjusted mastery at time `now`. Equal to stored mastery while the item
 * is not overdue; decays exponentially per overdue day after that.
 */
export function currentMastery(state: UserItemState, now: number): number {
  if (state.dueDate === null || now <= state.dueDate) return state.mastery
  const overdueDays = (now - state.dueDate) / DAY_MS
  return state.mastery * Math.pow(OVERDUE_RETENTION_PER_DAY, overdueDays)
}

/** Due = has been reviewed before and its due date has arrived. */
export function isDue(state: UserItemState, now: number): boolean {
  return state.dueDate !== null && state.dueDate <= now
}

/** Never attempted (fresh) item. */
export function isNew(state: UserItemState | undefined): boolean {
  return state === undefined || state.lastReviewed === null
}

/**
 * Grow the review interval SM-2 style for a *pass* (rep 1 → 1 day, rep 2 → 6
 * days, then interval × easiness). Used by both attempt kinds — the tempo
 * ladder and the understanding gate are their own quality signal, so easiness
 * is not nudged per attempt the way a 0–5 grade would.
 */
function nextPassInterval(state: UserItemState): {
  repetitions: number
  interval: number
} {
  const repetitions = state.repetitions + 1
  let interval: number
  if (repetitions === 1) interval = 1
  else if (repetitions === 2) interval = 6
  else interval = Math.round(state.interval * state.easiness)
  return { repetitions, interval }
}

/**
 * Apply one metronome-drill attempt. `bestBpm` is monotonic (a personal
 * record); mastery is derived from best ÷ target, so a single clean run at
 * (or near) target masters the item — no "do it four times to fill the bar"
 * grind. Reaching the mastery target grows the review interval (light spaced
 * review); still climbing keeps it in near rotation with no penalty.
 */
export function applyDrillAttempt(
  state: UserItemState,
  bpm: number,
  targetBpm: number,
  now: number,
): UserItemState {
  if (!(bpm >= 0)) {
    throw new RangeError(`bpm must be a non-negative number, got ${bpm}`)
  }
  if (!(targetBpm > 0)) {
    throw new RangeError(`targetBpm must be positive, got ${targetBpm}`)
  }

  const bestBpm = Math.max(state.bestBpm ?? 0, bpm)
  const mastery = clamp(Math.round((100 * bestBpm) / targetBpm), 0, 100)

  const progression =
    mastery >= ITEM_MASTERY_TARGET
      ? nextPassInterval(state)
      : { repetitions: 0, interval: 1 }

  return {
    itemId: state.itemId,
    easiness: state.easiness,
    interval: progression.interval,
    repetitions: progression.repetitions,
    mastery,
    bestBpm,
    dueDate: now + progression.interval * DAY_MS,
    lastReviewed: now,
  }
}

/**
 * Apply one understanding-gate attempt. "Got it" masters the item and schedules
 * a light review; "Not yet" simply resurfaces it next session with no penalty
 * (a gate is a comprehension check, never a thing to grind toward mastery).
 */
export function applyGateAttempt(
  state: UserItemState,
  got: boolean,
  now: number,
): UserItemState {
  const progression = got ? nextPassInterval(state) : { repetitions: 0, interval: 1 }
  return {
    itemId: state.itemId,
    easiness: state.easiness,
    interval: progression.interval,
    repetitions: progression.repetitions,
    mastery: got ? 100 : state.mastery,
    bestBpm: state.bestBpm ?? null,
    dueDate: now + progression.interval * DAY_MS,
    lastReviewed: now,
  }
}

/**
 * Apply one graded attempt in the new attempt model, dispatching on kind. This
 * is the boundary the UI and persistence layers call; the two kind-specific
 * functions above hold the actual scheduling math and are unit-tested directly.
 */
export function applyAttempt(
  state: UserItemState,
  result: AttemptResult,
  now: number,
): UserItemState {
  return result.kind === 'gate'
    ? applyGateAttempt(state, result.got, now)
    : applyDrillAttempt(state, result.bpm, result.targetBpm, now)
}
