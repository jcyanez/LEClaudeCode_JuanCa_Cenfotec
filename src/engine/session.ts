/**
 * Session assembly — ties Engine A (SRS) and Engine B (graph) together.
 *
 * From the set of available + in-progress nodes on the active path, build a
 * TIME-BUDGETED session (Quick ≈ 10 min / Standard ≈ 25 / Long ≈ 45) with a
 * 70% due-for-review / 20% stretch (edge-of-ability) / 10% new-node-intro
 * mix by estimated time. Locked and off-path content is never surfaced.
 *
 * Bucket definitions:
 * - due:     attempted items whose dueDate has arrived, most overdue first.
 * - stretch: attempted items not yet due whose mastery is still below target —
 *            hardest first (edge of ability).
 * - fresh:   never-attempted items. Items from nodes already in progress come
 *            first (finish what you started), then new available nodes by
 *            tier, so "new node intro" flows top-down through the tree.
 *
 * Filling: each bucket may spend up to its time share of the budget (an item
 * may overshoot its bucket's share by at most its own estimate). Unspent
 * budget backfills from leftover items in bucket-priority order (due →
 * stretch → fresh), so a brand-new user gets an all-fresh first session and a
 * caught-up user gets extra stretch/fresh work. Assembly stops adding items
 * once the total estimate reaches the budget.
 *
 * Deterministic on purpose (no shuffling): given the same states and `now`,
 * the same session comes out — which makes it directly testable.
 */

import type { Item, ItemType, Path, UserItemState, UserNodeState } from './types'
import type { SkillGraph } from './graph'
import { computeAllNodeStates, practicableNodes } from './graph'
import { currentMastery, isDue, isNew, ITEM_MASTERY_TARGET } from './srs'

/** Estimated minutes to perform one item, by type (used to budget sessions). */
export const ITEM_MINUTES: Record<ItemType, number> = {
  note_id: 0.5,
  chord_change: 1.5,
  scale_run: 2,
  technique_rep: 2.5,
  riff: 3,
}

/** Session length presets, in estimated minutes. Standard is the default. */
export const SESSION_BUDGETS = {
  quick: 10,
  standard: 25,
  long: 45,
} as const

export type SessionLength = keyof typeof SESSION_BUDGETS

export const DUE_RATIO = 0.7
export const STRETCH_RATIO = 0.2

export function estimateMinutes(item: Item): number {
  return ITEM_MINUTES[item.type]
}

export function estimateSessionMinutes(items: Item[]): number {
  return items.reduce((sum, item) => sum + estimateMinutes(item), 0)
}

export interface SessionOptions {
  /**
   * Bonus-practice mode: leave the due bucket empty and build the session
   * from stretch + fresh only. Never drags not-due, at-target items forward.
   */
  excludeDue?: boolean
}

/**
 * Earliest *future* due date among items on eligible (practicable) nodes,
 * or null when nothing is scheduled. Powers the "next review in ~Xh" copy.
 */
export function nextDueAt(
  allItems: Item[],
  itemStates: Map<string, UserItemState>,
  eligibleNodeIds: ReadonlySet<string>,
  now: number,
): number | null {
  let earliest: number | null = null
  for (const item of allItems) {
    if (!eligibleNodeIds.has(item.nodeId)) continue
    const due = itemStates.get(item.id)?.dueDate
    if (due != null && due > now && (earliest === null || due < earliest)) {
      earliest = due
    }
  }
  return earliest
}

export interface SessionPlan {
  due: Item[]
  stretch: Item[]
  fresh: Item[]
  /** The assembled session: due, then stretch, then fresh, then backfill. */
  items: Item[]
  /** Sum of the picked items' estimated minutes. */
  estimatedMinutes: number
}

export function assembleSession(
  graph: SkillGraph,
  path: Path,
  allItems: Item[],
  itemStates: Map<string, UserItemState>,
  now: number,
  budgetMinutes: number = SESSION_BUDGETS.standard,
  options: SessionOptions = {},
): SessionPlan {
  const nodeStates: Map<string, UserNodeState> = computeAllNodeStates(
    graph,
    itemStates,
    now,
  )
  const eligibleNodeIds = new Set(
    practicableNodes(graph, path, nodeStates).map((n) => n.id),
  )
  const pool = allItems.filter((item) => eligibleNodeIds.has(item.nodeId))

  const due: Item[] = []
  const stretch: Item[] = []
  const fresh: Item[] = []
  for (const item of pool) {
    const state = itemStates.get(item.id)
    if (isNew(state)) {
      fresh.push(item)
    } else if (isDue(state!, now)) {
      if (!options.excludeDue) due.push(item)
    } else if (currentMastery(state!, now) < ITEM_MASTERY_TARGET) {
      stretch.push(item)
    }
    // Attempted, not due, at/above target → nothing to do until it comes due.
  }

  due.sort((a, b) => itemStates.get(a.id)!.dueDate! - itemStates.get(b.id)!.dueDate!)
  stretch.sort((a, b) => b.difficulty - a.difficulty)

  const tierOf = (item: Item) => graph.nodesById.get(item.nodeId)?.tier ?? 0
  const inProgress = (item: Item) =>
    nodeStates.get(item.nodeId)?.status === 'in_progress' ? 0 : 1
  fresh.sort(
    (a, b) =>
      inProgress(a) - inProgress(b) ||
      tierOf(a) - tierOf(b) ||
      a.nodeId.localeCompare(b.nodeId) ||
      a.difficulty - b.difficulty,
  )

  // Fill each bucket up to its time share, tracking total spend throughout.
  let totalUsed = 0
  const takeFrom = (source: Item[], bucketLimit: number): Item[] => {
    const chosen: Item[] = []
    let bucketUsed = 0
    for (const item of source) {
      if (totalUsed >= budgetMinutes || bucketUsed >= bucketLimit) break
      chosen.push(item)
      const minutes = estimateMinutes(item)
      bucketUsed += minutes
      totalUsed += minutes
    }
    return chosen
  }

  const dueTaken = takeFrom(due, budgetMinutes * DUE_RATIO)
  const stretchTaken = takeFrom(stretch, budgetMinutes * STRETCH_RATIO)
  const freshTaken = takeFrom(fresh, budgetMinutes * (1 - DUE_RATIO - STRETCH_RATIO))

  const picked: Item[] = [...dueTaken, ...stretchTaken, ...freshTaken]

  // Backfill unspent budget from leftover items, keeping bucket priority.
  const leftovers = [
    ...due.slice(dueTaken.length),
    ...stretch.slice(stretchTaken.length),
    ...fresh.slice(freshTaken.length),
  ]
  for (const item of leftovers) {
    if (totalUsed >= budgetMinutes) break
    picked.push(item)
    totalUsed += estimateMinutes(item)
  }

  const pickedIds = new Set(picked.map((i) => i.id))
  return {
    due: due.filter((i) => pickedIds.has(i.id)),
    stretch: stretch.filter((i) => pickedIds.has(i.id)),
    fresh: fresh.filter((i) => pickedIds.has(i.id)),
    items: picked,
    estimatedMinutes: totalUsed,
  }
}
