/**
 * nodesAtRisk — one test per row of the approved decision table.
 *
 * At risk = mastered at `now` (every item's effective mastery ≥ 80) but no
 * longer mastered at `now + horizonDays` under projected overdue decay.
 * "Already fell" (weakened / in_progress) is deliberately NOT at risk — that
 * state is reported by computeNodeStatus / isNodeWeakened.
 */

import { describe, expect, it } from 'vitest'
import { buildGraph, computeNodeStatus, nodesAtRisk } from './graph'
import { DAY_MS } from './srs'
import type { SkillNode, UserItemState } from './types'

const T0 = 1_750_000_000_000

function mkNode(id: string, prerequisites: string[], items: string[]): SkillNode {
  return { id, name: id, description: '', tier: 0, prerequisites, tags: [], items }
}

function mkState(
  itemId: string,
  overrides: Partial<UserItemState> = {},
): UserItemState {
  return {
    itemId,
    easiness: 2.5,
    interval: 6,
    repetitions: 3,
    mastery: 100,
    bestBpm: null,
    // Due exactly now: decay starts accruing immediately after T0.
    dueDate: T0,
    lastReviewed: T0 - 6 * DAY_MS,
    ...overrides,
  }
}

function statesOf(...states: UserItemState[]): Map<string, UserItemState> {
  return new Map(states.map((s) => [s.itemId, s]))
}

const ids = (nodes: SkillNode[]) => nodes.map((n) => n.id)

// Reference decay: 100 × 0.97^7 ≈ 80.8 (still ≥ 80); 100 × 0.97^8 ≈ 78.4 (< 80).

describe('nodesAtRisk — decision table', () => {
  it('row 1: the first item to fall puts the node at risk, not the average', () => {
    const node = mkNode('T', [], ['t1', 't2'])
    const g = buildGraph([node])
    const states = statesOf(
      mkState('t1'), // due now → ≈78.4 at day 8
      mkState('t2', { dueDate: T0 + 365 * DAY_MS }), // no decay in horizon
    )
    // Average at day 8 ≈ (78.4 + 100) / 2 ≈ 89 — an average rule would say safe.
    expect(ids(nodesAtRisk(g, states, T0, 8))).toEqual(['T'])
  })

  it('row 2: a never-practiced node is not at risk', () => {
    const g = buildGraph([mkNode('N', [], ['n1'])])
    expect(nodesAtRisk(g, new Map(), T0, 30)).toEqual([])
  })

  it('row 3: a node already below target at now has fallen — not "at risk"', () => {
    const g = buildGraph([mkNode('F', [], ['f1'])])
    // 10 days overdue at now: 100 × 0.97^10 ≈ 73.7 < 80 already.
    const states = statesOf(mkState('f1', { dueDate: T0 - 10 * DAY_MS }))
    expect(nodesAtRisk(g, states, T0, 30)).toEqual([])
  })

  it('row 4: maintenance nodes are eligible — maintenance is not immunity', () => {
    const node = mkNode('M', [], ['m1'])
    const g = buildGraph([node])
    const states = statesOf(
      mkState('m1', { mastery: 90, interval: 30, dueDate: T0 + 2 * DAY_MS }),
    )
    expect(computeNodeStatus(g, node, states, T0)).toBe('maintenance')
    // At day 12 it is 10 days overdue: 90 × 0.97^10 ≈ 66.3 < 80.
    expect(ids(nodesAtRisk(g, states, T0, 12))).toEqual(['M'])
  })

  it('row 5: a node with no items can never be at risk', () => {
    const g = buildGraph([mkNode('E', [], [])])
    expect(nodesAtRisk(g, new Map(), T0, 30)).toEqual([])
  })

  it('row 6: exactly 80 at the horizon instant is still mastered — not at risk', () => {
    const g = buildGraph([mkNode('X', [], ['x1'])])
    // Mastery exactly 80, due exactly at the horizon instant: no decay yet
    // there (spec: no decay at or before dueDate), so effective mastery is
    // exactly 80 ≥ 80.
    const states = statesOf(mkState('x1', { mastery: 80, dueDate: T0 + 5 * DAY_MS }))
    expect(nodesAtRisk(g, states, T0, 5)).toEqual([])
    // Any horizon past the due date starts strict decay: 80 × 0.97^ε < 80.
    expect(ids(nodesAtRisk(g, states, T0, 5.1))).toEqual(['X'])
  })

  it('row 6 (decay crossing): horizon just before the drop is safe, just after is at risk', () => {
    const g = buildGraph([mkNode('X', [], ['x1'])])
    const states = statesOf(mkState('x1')) // 100, due now
    expect(nodesAtRisk(g, states, T0, 7)).toEqual([]) // ≈80.8 ≥ 80
    expect(ids(nodesAtRisk(g, states, T0, 8))).toEqual(['X']) // ≈78.4 < 80
  })

  it('row 7: horizonDays = 0 projects to now itself — empty result', () => {
    const g = buildGraph([mkNode('X', [], ['x1'])])
    const states = statesOf(mkState('x1'))
    expect(nodesAtRisk(g, states, T0, 0)).toEqual([])
  })

  it('row 8: negative or non-finite horizons throw RangeError', () => {
    const g = buildGraph([mkNode('X', [], ['x1'])])
    const states = statesOf(mkState('x1'))
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => nodesAtRisk(g, states, T0, bad)).toThrow(RangeError)
    }
  })

  it('row 9: fractional horizons are valid — decay is continuous', () => {
    const g = buildGraph([mkNode('X', [], ['x1'])])
    const states = statesOf(mkState('x1', { mastery: 81 })) // due now
    // 81 × 0.97^0.25 ≈ 80.4 (safe); 81 × 0.97^0.5 ≈ 79.8 (falls).
    expect(nodesAtRisk(g, states, T0, 0.25)).toEqual([])
    expect(ids(nodesAtRisk(g, states, T0, 0.5))).toEqual(['X'])
  })

  it('row 10: an item with no state means the node is not mastered now — excluded', () => {
    const g = buildGraph([mkNode('P', [], ['p1', 'p2'])])
    const states = statesOf(mkState('p1')) // p2 missing → mastery 0
    expect(nodesAtRisk(g, states, T0, 30)).toEqual([])
  })

  it('row 11: results follow topological order (prereqs first) and are unique', () => {
    const dep = mkNode('DEP', ['ROOT'], ['d1'])
    const root = mkNode('ROOT', [], ['r1'])
    // Input order deliberately dependent-first.
    const g = buildGraph([dep, root])
    const states = statesOf(mkState('d1'), mkState('r1'))
    const result = nodesAtRisk(g, states, T0, 8)
    expect(ids(result)).toEqual(['ROOT', 'DEP'])
    expect(new Set(result).size).toBe(result.length)
  })

  it('purity: does not mutate the input states', () => {
    const g = buildGraph([mkNode('X', [], ['x1'])])
    const original = mkState('x1')
    const states = statesOf(original)
    const snapshot = structuredClone(original)
    nodesAtRisk(g, states, T0, 8)
    expect(states.get('x1')).toEqual(snapshot)
    expect(states.size).toBe(1)
  })
})
