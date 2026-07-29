/**
 * Functional time-invariants suite.
 *
 * Guards the CLASS of defect behind the overdue-decay bug — confusing stored
 * state with state derived for the queried instant — anywhere in the engine,
 * not just the line that was fixed. Three layers:
 *
 * 1. Full lifecycle against the real Metal seed: practice roots to mastery
 *    through applyAttempt (the same entry point the app uses), then let time
 *    pass and check unlock → rot → re-lock end to end.
 * 2. A half-day sweep over 60 days asserting, at every instant, that derived
 *    node status agrees with the items' effective mastery at that SAME
 *    instant (the exact incoherence the original bug produced).
 * 3. Purity: deriving states at many instants never mutates stored state.
 *
 * Deterministic: fixed T0, no wall clock, no randomness.
 */

import { describe, expect, it } from 'vitest'
import { loadMetalContent } from '../data/loader'
import {
  buildGraph,
  computeAllNodeStates,
  isNodeWeakened,
  nodesAtRisk,
  weakenedPrereqs,
} from './graph'
import {
  applyAttempt,
  currentMastery,
  DAY_MS,
  initialItemState,
  ITEM_MASTERY_TARGET,
} from './srs'
import type { Item, SkillNode, UserItemState } from './types'

const T0 = 1_750_000_000_000

/** Master one item the way the app would: ace the gate or hit target tempo. */
function ace(item: Item, now: number): UserItemState {
  const result =
    item.metadata.gate === true
      ? ({ kind: 'gate', got: true } as const)
      : ({
          kind: 'drill',
          bpm: item.metadata.targetBpm as number,
          targetBpm: item.metadata.targetBpm as number,
        } as const)
  return applyAttempt(initialItemState(item.id), result, now)
}

describe('lifecycle against the real Metal seed', () => {
  const { graph, items } = loadMetalContent()
  const rootIds = new Set(
    graph.nodes.filter((n) => n.prerequisites.length === 0).map((n) => n.id),
  )
  // Dependents gated exclusively by roots: unlocked at T0, re-locked on rot.
  const rootGated = graph.nodes.filter(
    (n) =>
      n.prerequisites.length > 0 &&
      n.prerequisites.every((p) => rootIds.has(p)),
  )

  // Practice every root item to mastery at T0 via the app's entry point.
  const states = new Map<string, UserItemState>()
  for (const item of items) {
    if (rootIds.has(item.nodeId)) states.set(item.id, ace(item, T0))
  }

  it('mastering the roots unlocks their direct dependents', () => {
    const at0 = computeAllNodeStates(graph, states, T0)
    for (const id of rootIds) {
      expect(at0.get(id)!.status).toBe('mastered')
    }
    expect(rootGated.length).toBeGreaterThan(0)
    for (const node of rootGated) {
      expect(at0.get(node.id)!.status).toBe('available')
    }
  })

  it('at the due date nothing has decayed yet', () => {
    // First pass schedules a 1-day review interval.
    const atDue = computeAllNodeStates(graph, states, T0 + 1 * DAY_MS)
    for (const id of rootIds) {
      expect(atDue.get(id)!.status).toBe('mastered')
    }
  })

  it('40 days overdue: roots rot, dependents re-lock, guidance points at a root', () => {
    const monthLater = T0 + 41 * DAY_MS // 100 × 0.97^40 ≈ 29.6 < 80
    const rotted = computeAllNodeStates(graph, states, monthLater)
    for (const id of rootIds) {
      expect(rotted.get(id)!.status).toBe('in_progress')
      expect(isNodeWeakened(graph.nodesById.get(id)!, states, monthLater)).toBe(true)
    }
    for (const node of rootGated) {
      expect(rotted.get(node.id)!.status).toBe('locked')
      const guidance = weakenedPrereqs(graph, node.id, states, monthLater)
      expect(guidance.length).toBeGreaterThan(0)
      expect(rootIds.has(guidance[0]!.id)).toBe(true)
    }
  })

  it('while still fresh, every mastered root is flagged at risk for a 30-day horizon', () => {
    const atRisk = nodesAtRisk(graph, states, T0 + 1 * DAY_MS, 30)
    expect(new Set(atRisk.map((n) => n.id))).toEqual(rootIds)
  })
})

describe('half-day sweep: derived status always agrees with effective mastery', () => {
  const mkNode = (id: string, prerequisites: string[], items: string[]): SkillNode => ({
    id, name: id, description: '', tier: 0, prerequisites, tags: [], items,
  })
  const A = mkNode('A', [], ['a1'])
  const B = mkNode('B', ['A'], ['b1'])
  const g = buildGraph([A, B])
  const a1: UserItemState = {
    itemId: 'a1',
    easiness: 2.5,
    interval: 6,
    repetitions: 3,
    mastery: 90,
    bestBpm: null,
    dueDate: T0 + 6 * DAY_MS,
    lastReviewed: T0,
  }
  const states = new Map([['a1', a1]])

  it('over 60 days, no instant shows a mastered node whose items have rotted', () => {
    let previousEffective = Number.POSITIVE_INFINITY
    for (let halfDays = 0; halfDays <= 120; halfDays++) {
      const now = T0 + halfDays * (DAY_MS / 2)
      const effective = currentMastery(a1, now)
      const nodeStates = computeAllNodeStates(g, states, now)
      const statusA = nodeStates.get('A')!.status

      // Effective mastery never rises with the mere passage of time.
      expect(effective).toBeLessThanOrEqual(previousEffective)
      previousEffective = effective

      // The bug's signature: a mastered/maintenance status is only legal while
      // every item holds the target AT THIS instant.
      if (statusA === 'mastered' || statusA === 'maintenance') {
        expect(effective).toBeGreaterThanOrEqual(ITEM_MASTERY_TARGET)
      }
      // Two-node chain: B is locked exactly when A's item is below target.
      expect(nodeStates.get('B')!.status).toBe(
        effective < ITEM_MASTERY_TARGET ? 'locked' : 'available',
      )
      // "Will fall" and "already fell" never overlap.
      const atRiskNow = nodesAtRisk(g, states, now, 7).some((n) => n.id === 'A')
      const weakenedNow = isNodeWeakened(A, states, now)
      expect(atRiskNow && weakenedNow).toBe(false)
      expect(weakenedNow).toBe(effective < ITEM_MASTERY_TARGET)
    }
  })

  it('deriving states at any instant never mutates stored item state', () => {
    const snapshot = structuredClone(a1)
    for (let day = 0; day <= 60; day += 5) {
      computeAllNodeStates(g, states, T0 + day * DAY_MS)
      nodesAtRisk(g, states, T0 + day * DAY_MS, 14)
    }
    expect(states.get('a1')).toEqual(snapshot)
    expect(states.size).toBe(1)
  })
})
