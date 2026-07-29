/**
 * Sync merge kernel — the §2 conflict rule of
 * the sync design, as pure code.
 *
 * This is the correctness core of multi-device sync: every device AND the
 * server-side RPC apply this exact total order, which is what makes state
 * convergence a mathematical property instead of a hope. The rule:
 *
 *   1. Later `lastReviewed` wins (null = −∞) — the most recent actual
 *      practice event is the truth.
 *   2. Tie → later `updatedAt` wins (missing = −∞).
 *   3. Tie → lexicographically larger `deviceId` wins (missing = '').
 *   4. Still tied (identical stamps, pathological divergent content) →
 *      larger canonical serialization wins. Never happens in practice, but
 *      it makes the merge a total order over VALUES, so commutativity holds
 *      unconditionally.
 *
 * Everything here is engine-grade: pure, deterministic, no I/O, no Date.
 * The SQL implementation of `push_item_states` must match this file;
 * merge.test.ts is the executable contract both sides are held to.
 */

import type { UserItemState } from '../engine/types'

const NEG_INF = Number.NEGATIVE_INFINITY

/** Canonical serialization: stable key order, so rule 4 is deterministic. */
function canonical(state: UserItemState): string {
  return JSON.stringify({
    itemId: state.itemId,
    easiness: state.easiness,
    interval: state.interval,
    repetitions: state.repetitions,
    mastery: state.mastery,
    dueDate: state.dueDate,
    lastReviewed: state.lastReviewed,
    updatedAt: state.updatedAt ?? null,
    deviceId: state.deviceId ?? null,
  })
}

/**
 * Total order over item states: negative = a loses, positive = a wins,
 * 0 = identical by every criterion (a and b are interchangeable).
 */
export function compareStates(a: UserItemState, b: UserItemState): number {
  const reviewedA = a.lastReviewed ?? NEG_INF
  const reviewedB = b.lastReviewed ?? NEG_INF
  if (reviewedA !== reviewedB) return reviewedA < reviewedB ? -1 : 1

  const updatedA = a.updatedAt ?? NEG_INF
  const updatedB = b.updatedAt ?? NEG_INF
  if (updatedA !== updatedB) return updatedA < updatedB ? -1 : 1

  const deviceA = a.deviceId ?? ''
  const deviceB = b.deviceId ?? ''
  if (deviceA !== deviceB) return deviceA < deviceB ? -1 : 1

  const canonA = canonical(a)
  const canonB = canonical(b)
  if (canonA !== canonB) return canonA < canonB ? -1 : 1
  return 0
}

/**
 * Should `incoming` replace `existing`? Strict: equal states don't churn
 * writes (idempotent pulls/pushes are no-ops).
 */
export function shouldReplace(
  incoming: UserItemState,
  existing: UserItemState,
): boolean {
  return compareStates(incoming, existing) > 0
}

/** The winner of two divergent states. Commutative, associative, idempotent. */
export function mergeItemState(
  a: UserItemState,
  b: UserItemState,
): UserItemState {
  return compareStates(a, b) >= 0 ? a : b
}

/**
 * Reset watermark (§4.3): given a reset that happened at `resetAt`, return
 * the itemIds whose states must be discarded — everything whose last review
 * predates the reset (never-reviewed rows count as −∞ and die too). States
 * reviewed at-or-after the reset are newer knowledge and survive.
 */
export function applyReset(
  states: Iterable<UserItemState>,
  resetAt: number,
): string[] {
  const discard: string[] = []
  for (const state of states) {
    if ((state.lastReviewed ?? NEG_INF) < resetAt) discard.push(state.itemId)
  }
  return discard
}
