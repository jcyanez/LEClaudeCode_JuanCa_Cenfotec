/**
 * Regression: overdue decay must flow through node status derivation.
 *
 * Field report: after ~a month away, the map still showed skills as mastered
 * even though their items were long overdue. Per spec, effective mastery
 * decays 3%/day past dueDate, a node loses mastery below 80, and its
 * dependents re-lock. These tests exercise that contract end-to-end through
 * the graph engine (behavior level, fixed `now`, no wall clock).
 */

import { describe, expect, it } from 'vitest'
import {
  buildGraph,
  computeAllNodeStates,
  isNodeWeakened,
  weakenedPrereqs,
} from './graph'
import { assembleSession } from './session'
import { currentMastery, DAY_MS } from './srs'
import type { Item, Path, SkillNode, UserItemState } from './types'

const T0 = 1_750_000_000_000

function mkNode(id: string, prerequisites: string[], items: string[]): SkillNode {
  return { id, name: id, description: '', tier: 0, prerequisites, tags: [], items }
}

/** An item earned to full mastery at T0, scheduled for review at T0 + 6d. */
function masteredState(itemId: string): UserItemState {
  return {
    itemId,
    easiness: 2.5,
    interval: 6,
    repetitions: 3,
    mastery: 100,
    bestBpm: null,
    dueDate: T0 + 6 * DAY_MS,
    lastReviewed: T0,
  }
}

// A ── B: B unlocks only while A is mastered.
const A = mkNode('A', [], ['a1'])
const B = mkNode('B', ['A'], ['b1'])
const graph = buildGraph([A, B])
const states = new Map([['a1', masteredState('a1')]])

describe('regression — a month of overdue decay demotes a mastered node', () => {
  it('sanity: at dueDate the node is still mastered and its dependent unlocked', () => {
    const atDue = computeAllNodeStates(graph, states, T0 + 6 * DAY_MS)
    expect(atDue.get('A')!.status).toBe('mastered')
    expect(atDue.get('B')!.status).toBe('available')
  })

  it('30 days overdue: the node loses mastered status and its dependent re-locks', () => {
    // 100 × 0.97^30 ≈ 40.1 — far below the 80 target.
    const monthLater = computeAllNodeStates(graph, states, T0 + 36 * DAY_MS)
    expect(monthLater.get('A')!.status).toBe('in_progress')
    expect(monthLater.get('B')!.status).toBe('locked')
  })

  it('the overdue item itself reads with exponential decay applied', () => {
    const a1 = states.get('a1')!
    expect(currentMastery(a1, T0 + 36 * DAY_MS)).toBeCloseTo(100 * 0.97 ** 30, 6)
  })
})

describe('product contract — rusty detection and guidance', () => {
  const monthLater = T0 + 36 * DAY_MS

  it('an earned-then-rotted node reads as weakened; a fresh one does not', () => {
    expect(isNodeWeakened(A, states, monthLater)).toBe(true)
    // Still fresh at its due date: mastered, not weakened.
    expect(isNodeWeakened(A, states, T0 + 6 * DAY_MS)).toBe(false)
    // Never earned (no state at all): locked-as-usual, not weakened.
    expect(isNodeWeakened(B, states, monthLater)).toBe(false)
  })

  it('the UI can ask which prerequisite of a re-locked node needs refreshing', () => {
    expect(weakenedPrereqs(graph, 'B', states, monthLater).map((n) => n.id)).toEqual(['A'])
    expect(weakenedPrereqs(graph, 'B', states, T0 + 6 * DAY_MS)).toEqual([])
  })

  it('maintenance is not immune to decay: a long-interval node rusts too', () => {
    const longHaul = new Map([
      ['a1', { ...masteredState('a1'), interval: 30, dueDate: T0 + 30 * DAY_MS }],
    ])
    const atDue = computeAllNodeStates(graph, longHaul, T0 + 30 * DAY_MS)
    expect(atDue.get('A')!.status).toBe('maintenance')
    // 31 days overdue: 100 × 0.97^31 ≈ 38.9 < 80.
    const rotted = computeAllNodeStates(graph, longHaul, T0 + 61 * DAY_MS)
    expect(rotted.get('A')!.status).toBe('in_progress')
    expect(rotted.get('B')!.status).toBe('locked')
  })

  it('a rotted node re-enters the session pool so its items can be reviewed', () => {
    const mkItem = (id: string, nodeId: string): Item => ({
      id,
      nodeId,
      type: 'technique_rep',
      prompt: id,
      answer: id,
      difficulty: 3,
      metadata: {},
    })
    const path: Path = { id: 'p', name: 'P', nodeIds: ['A', 'B'], goalNodeIds: ['B'] }
    const items = [mkItem('a1', 'A'), mkItem('b1', 'B')]

    // While A reads mastered it is not practicable (B, unlocked, offers its
    // fresh item instead).
    const atDue = assembleSession(graph, path, items, states, T0 + 6 * DAY_MS)
    expect(atDue.items.map((i) => i.id)).toEqual(['b1'])

    // Once rotted, A is in_progress again and its overdue item comes up for
    // review — while B, re-locked, drops out of the pool.
    const rusty = assembleSession(graph, path, items, states, T0 + 36 * DAY_MS)
    expect(rusty.due.map((i) => i.id)).toEqual(['a1'])
    expect(rusty.items.map((i) => i.id)).toContain('a1')
    expect(rusty.items.map((i) => i.id)).not.toContain('b1')
  })
})
