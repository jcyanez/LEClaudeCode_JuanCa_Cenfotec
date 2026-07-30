import { describe, expect, it } from 'vitest'
import {
  buildGraph,
  computeAllNodeStates,
  computeDepths,
  computeNodeStatus,
  GraphValidationError,
  isNodeMastered,
  MAINTENANCE_INTERVAL_DAYS,
  nodeMasteryAvg,
  practicableNodes,
  transitivelyRedundantEdges,
  unlocksAfter,
} from './graph'
import { DAY_MS } from './srs'
import type { Path, SkillNode, UserItemState } from './types'

const T0 = 1_750_000_000_000

function mkNode(
  id: string,
  prerequisites: string[],
  items: string[],
  tier = 0,
): SkillNode {
  return { id, name: id, description: '', tier, prerequisites, tags: [], items }
}

/** Item state helper: mastered = 90 mastery, due in the future. */
function mkState(
  itemId: string,
  overrides: Partial<UserItemState> = {},
): UserItemState {
  return {
    itemId,
    easiness: 2.5,
    interval: 6,
    repetitions: 3,
    mastery: 90,
    bestBpm: null,
    dueDate: T0 + 6 * DAY_MS,
    lastReviewed: T0,
    ...overrides,
  }
}

function statesOf(...states: UserItemState[]): Map<string, UserItemState> {
  return new Map(states.map((s) => [s.itemId, s]))
}

// A ── B ── C   (C also depends directly on A)
const A = mkNode('A', [], ['a1'], 0)
const B = mkNode('B', ['A'], ['b1'], 1)
const C = mkNode('C', ['A', 'B'], ['c1'], 2)
const fixture = () => buildGraph([A, B, C])

describe('buildGraph — validation', () => {
  it('accepts a valid DAG and produces a topological order', () => {
    const g = fixture()
    expect(g.topoOrder).toEqual(['A', 'B', 'C'])
    expect(g.dependents.get('A')).toEqual(['B', 'C'])
  })

  it('rejects duplicate node ids', () => {
    expect(() => buildGraph([A, mkNode('A', [], [])])).toThrow(
      GraphValidationError,
    )
  })

  it('rejects dangling prerequisite references', () => {
    expect(() => buildGraph([mkNode('X', ['GHOST'], [])])).toThrow(
      /missing prerequisite GHOST/,
    )
  })

  it('rejects cycles and names the nodes involved', () => {
    const x = mkNode('X', ['Z'], [])
    const y = mkNode('Y', ['X'], [])
    const z = mkNode('Z', ['Y'], [])
    const ok = mkNode('OK', [], [])
    expect(() => buildGraph([x, y, z, ok])).toThrow(/cycle involving: X, Y, Z/)
  })

  it('rejects a self-loop', () => {
    expect(() => buildGraph([mkNode('X', ['X'], [])])).toThrow(
      GraphValidationError,
    )
  })
})

describe('node mastery', () => {
  it('a node is mastered only when every item is at/above target', () => {
    const twoItems = mkNode('T', [], ['t1', 't2'])
    const g = buildGraph([twoItems])
    expect(
      isNodeMastered(twoItems, statesOf(mkState('t1'), mkState('t2')), T0),
    ).toBe(true)
    expect(
      isNodeMastered(
        twoItems,
        statesOf(mkState('t1'), mkState('t2', { mastery: 50 })),
        T0,
      ),
    ).toBe(false)
    expect(isNodeMastered(twoItems, statesOf(mkState('t1')), T0)).toBe(false)
    expect(g.nodesById.get('T')).toBe(twoItems)
  })

  it('a node with no items can never be mastered', () => {
    const empty = mkNode('E', [], [])
    expect(isNodeMastered(empty, new Map(), T0)).toBe(false)
    expect(nodeMasteryAvg(empty, new Map(), T0)).toBe(0)
  })

  it('masteryAvg is the mean of decay-adjusted item mastery, missing = 0', () => {
    const twoItems = mkNode('T', [], ['t1', 't2'])
    const states = statesOf(mkState('t1', { mastery: 60 }))
    expect(nodeMasteryAvg(twoItems, states, T0)).toBe(30)
  })
})

describe('computeNodeStatus — lifecycle', () => {
  it('locked while any prerequisite is unmastered; available when all met', () => {
    const g = fixture()
    const none = new Map<string, UserItemState>()
    expect(computeNodeStatus(g, A, none, T0)).toBe('available')
    expect(computeNodeStatus(g, B, none, T0)).toBe('locked')
    expect(computeNodeStatus(g, C, none, T0)).toBe('locked')
  })

  it('in_progress once any item has been attempted', () => {
    const g = fixture()
    const states = statesOf(mkState('a1', { mastery: 20, repetitions: 1 }))
    expect(computeNodeStatus(g, A, states, T0)).toBe('in_progress')
  })

  it('mastered when all items reach target; maintenance at long intervals', () => {
    const g = fixture()
    expect(computeNodeStatus(g, A, statesOf(mkState('a1')), T0)).toBe('mastered')
    const longInterval = statesOf(
      mkState('a1', {
        interval: MAINTENANCE_INTERVAL_DAYS,
        dueDate: T0 + MAINTENANCE_INTERVAL_DAYS * DAY_MS,
      }),
    )
    expect(computeNodeStatus(g, A, longInterval, T0)).toBe('maintenance')
  })

  it('maintenance still counts as mastered for unlocking dependents', () => {
    const g = fixture()
    const states = statesOf(
      mkState('a1', {
        interval: 30,
        dueDate: T0 + 30 * DAY_MS,
      }),
    )
    expect(computeNodeStatus(g, B, states, T0)).toBe('available')
  })
})

describe('mastery cascade', () => {
  it('mastering a node unlocks dependents whose prereqs are now all met', () => {
    const g = fixture()

    // Nothing mastered: only A is practicable.
    let states = new Map<string, UserItemState>()
    let nodeStates = computeAllNodeStates(g, states, T0)
    expect(nodeStates.get('A')!.status).toBe('available')
    expect(nodeStates.get('B')!.status).toBe('locked')
    expect(nodeStates.get('C')!.status).toBe('locked')

    // Master A → B unlocks, C still needs B.
    states = statesOf(mkState('a1'))
    nodeStates = computeAllNodeStates(g, states, T0)
    expect(nodeStates.get('A')!.status).toBe('mastered')
    expect(nodeStates.get('B')!.status).toBe('available')
    expect(nodeStates.get('C')!.status).toBe('locked')

    // Master B too → C unlocks.
    states = statesOf(mkState('a1'), mkState('b1'))
    nodeStates = computeAllNodeStates(g, states, T0)
    expect(nodeStates.get('C')!.status).toBe('available')
  })

})

describe('computeDepths', () => {
  it('depth = longest prerequisite chain from the roots', () => {
    const g = fixture() // A → B → C, C also depends on A directly
    const depths = computeDepths(g)
    expect(depths.get('A')).toBe(0)
    expect(depths.get('B')).toBe(1)
    expect(depths.get('C')).toBe(2) // longest chain wins over the direct A edge
  })

  it('every edge climbs: dependents are strictly deeper than prerequisites', () => {
    const g = fixture()
    const depths = computeDepths(g)
    for (const node of g.nodes) {
      for (const prereq of node.prerequisites) {
        expect(depths.get(node.id)!).toBeGreaterThan(depths.get(prereq)!)
      }
    }
  })
})

describe('transitivelyRedundantEdges', () => {
  it('flags the direct edge when a chain already implies it', () => {
    // C requires A and B, and B requires A → A→C is implied through B.
    const g = fixture()
    expect(transitivelyRedundantEdges(g)).toEqual(new Set(['A->C']))
  })

  it('keeps genuinely independent requirements', () => {
    // D requires two unrelated roots: neither implies the other.
    const x = mkNode('X', [], [])
    const y = mkNode('Y', [], [])
    const d = mkNode('D', ['X', 'Y'], [])
    expect(transitivelyRedundantEdges(buildGraph([x, y, d])).size).toBe(0)
  })
})

describe('queries', () => {
  const path: Path = { id: 'p', name: 'P', nodeIds: ['A', 'B', 'C'], goalNodeIds: ['C'] }

  it('practicableNodes returns available + in_progress nodes on the path only', () => {
    const g = fixture()
    const states = statesOf(mkState('a1'), mkState('b1', { mastery: 30 }))
    const nodeStates = computeAllNodeStates(g, states, T0)
    const ids = practicableNodes(g, path, nodeStates).map((n) => n.id)
    expect(ids).toEqual(['B']) // A mastered, B in_progress, C locked

    const narrowPath: Path = { ...path, nodeIds: ['A', 'C'] }
    expect(practicableNodes(g, narrowPath, nodeStates)).toEqual([])
  })

  it('unlocksAfter lists dependents for which this node is the last key', () => {
    const g = fixture()

    // Nothing mastered: mastering A unlocks B (C still needs B).
    expect(unlocksAfter(g, 'A', new Map(), T0).map((n) => n.id)).toEqual(['B'])

    // A mastered: mastering B unlocks C.
    const states = statesOf(mkState('a1'))
    expect(unlocksAfter(g, 'B', states, T0).map((n) => n.id)).toEqual(['C'])

    // Leaf node unlocks nothing.
    expect(unlocksAfter(g, 'C', states, T0)).toEqual([])
  })
})
