/**
 * Persistence operations: the only place where engine results are written to
 * IndexedDB. Node states are re-derived and re-persisted after every graded
 * attempt so the stored rollup never drifts from the item states.
 */

import { db } from './db'
import type {
  AttemptResult,
  Item,
  ItemResult,
  UserItemState,
} from '../engine/types'
import { applyAttempt as engineApplyAttempt, initialItemState } from '../engine/srs'
import { computeAllNodeStates, type SkillGraph } from '../engine/graph'

export async function getItemStatesMap(): Promise<Map<string, UserItemState>> {
  const rows = await db.itemStates.toArray()
  return new Map(rows.map((row) => [row.itemId, row]))
}

/**
 * Apply one attempt (gate got/not-yet or a metronome-drill best BPM): run the
 * SRS engine, persist the item state, then re-derive and persist node states so
 * the stored rollup never drifts from the item states.
 */
export async function applyAttempt(
  graph: SkillGraph,
  item: Item,
  result: AttemptResult,
  now: number,
): Promise<UserItemState> {
  const existing =
    (await db.itemStates.get(item.id)) ?? initialItemState(item.id)
  const next = engineApplyAttempt(existing, result, now)
  await db.itemStates.put(next)

  const itemStates = await getItemStatesMap()
  const nodeStates = computeAllNodeStates(graph, itemStates, now)
  await db.nodeStates.bulkPut([...nodeStates.values()])

  return next
}

export async function recordSession(
  itemResults: ItemResult[],
  date: number,
): Promise<void> {
  await db.sessions.put({ id: crypto.randomUUID(), date, itemResults })
}

/** Dev helper: wipe all progress (exposed in the UI footer). */
export async function resetProgress(): Promise<void> {
  await Promise.all([
    db.itemStates.clear(),
    db.nodeStates.clear(),
    db.sessions.clear(),
  ])
}
