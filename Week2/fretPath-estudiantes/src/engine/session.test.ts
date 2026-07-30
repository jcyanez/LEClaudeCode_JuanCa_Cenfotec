import { describe, expect, it } from 'vitest'
import { buildGraph } from './graph'
import { DAY_MS, ITEM_MASTERY_TARGET } from './srs'
import {
  assembleSession,
  estimateMinutes,
  estimateSessionMinutes,
  ITEM_MINUTES,
  nextDueAt,
  SESSION_BUDGETS,
} from './session'
import type { Item, Path, SkillNode, UserItemState } from './types'
import { loadMetalContent } from '../data/loader'

const T0 = 1_750_000_000_000

function mkNode(
  id: string,
  prerequisites: string[],
  items: string[],
  tier = 0,
): SkillNode {
  return { id, name: id, description: '', tier, prerequisites, tags: [], items }
}

/** Default fixture item: technique_rep = 2.5 estimated minutes. */
function mkItem(id: string, nodeId: string, difficulty = 3): Item {
  return {
    id,
    nodeId,
    type: 'technique_rep',
    prompt: id,
    answer: id,
    difficulty,
    metadata: {},
  }
}

function mkState(
  itemId: string,
  overrides: Partial<UserItemState> = {},
): UserItemState {
  return {
    itemId,
    easiness: 2.5,
    interval: 6,
    repetitions: 2,
    mastery: 40,
    bestBpm: null,
    dueDate: T0 + 3 * DAY_MS,
    lastReviewed: T0 - 3 * DAY_MS,
    ...overrides,
  }
}

describe('time estimates', () => {
  it('estimates per item type and sums a session', () => {
    const riff = { ...mkItem('r', 'X'), type: 'riff' as const }
    const note = { ...mkItem('n', 'X'), type: 'note_id' as const }
    expect(estimateMinutes(riff)).toBe(ITEM_MINUTES.riff)
    expect(estimateMinutes(note)).toBe(0.5)
    expect(estimateSessionMinutes([riff, note, mkItem('t', 'X')])).toBe(6)
  })
})

describe('assembleSession — budget and mix', () => {
  // OPEN has plenty of items in every bucket; GATED is locked behind LOCKER.
  // All fixture items are technique_rep = 2.5 min.
  const openItems = [
    // 12 due candidates
    ...Array.from({ length: 12 }, (_, i) => mkItem(`due-${i}`, 'OPEN', 3)),
    // 5 stretch candidates with varying difficulty (2..6)
    ...Array.from({ length: 5 }, (_, i) => mkItem(`str-${i}`, 'OPEN', i + 2)),
    // 5 fresh
    ...Array.from({ length: 5 }, (_, i) => mkItem(`new-${i}`, 'OPEN', 3)),
  ]
  const gatedItems = [mkItem('gated-1', 'GATED', 3)]
  const nodes = [
    mkNode('OPEN', [], openItems.map((i) => i.id), 0),
    mkNode('LOCKER', [], ['locker-1'], 0),
    mkNode('GATED', ['LOCKER'], gatedItems.map((i) => i.id), 1),
  ]
  const allItems = [...openItems, mkItem('locker-1', 'LOCKER'), ...gatedItems]
  const graph = buildGraph(nodes)
  const path: Path = {
    id: 'p',
    name: 'P',
    nodeIds: ['OPEN', 'LOCKER', 'GATED'],
    goalNodeIds: ['GATED'],
  }

  function fullStates(): Map<string, UserItemState> {
    const states = new Map<string, UserItemState>()
    // Due items, staggered overdue amounts (due-11 most overdue).
    for (let i = 0; i < 12; i++) {
      states.set(`due-${i}`, mkState(`due-${i}`, { dueDate: T0 - i * DAY_MS }))
    }
    // Stretch: attempted, not due, below target.
    for (let i = 0; i < 5; i++) {
      states.set(`str-${i}`, mkState(`str-${i}`, { mastery: 50 }))
    }
    return states
  }

  it('standard budget: fills 25 min with a 70/20/10 time mix', () => {
    const plan = assembleSession(graph, path, allItems, fullStates(), T0)
    // 2.5-min items: due share 17.5 min = 7, stretch 5 min = 2, fresh 2.5 = 1.
    expect(plan.due).toHaveLength(7)
    expect(plan.stretch).toHaveLength(2)
    expect(plan.fresh).toHaveLength(1)
    expect(plan.items).toHaveLength(10)
    expect(plan.estimatedMinutes).toBe(25)
  })

  it('quick budget: ~10 min, review-dominated', () => {
    const plan = assembleSession(
      graph, path, allItems, fullStates(), T0, SESSION_BUDGETS.quick,
    )
    expect(plan.due).toHaveLength(3) // 7.5 of a 7-min share
    expect(plan.stretch).toHaveLength(1)
    expect(plan.fresh).toHaveLength(0) // budget already spent
    expect(plan.estimatedMinutes).toBe(10)
  })

  it('long budget: ~45 min, exhausts due then widens', () => {
    const plan = assembleSession(
      graph, path, allItems, fullStates(), T0, SESSION_BUDGETS.long,
    )
    expect(plan.due).toHaveLength(12) // all of them (30 min < 31.5 share)
    expect(plan.stretch).toHaveLength(4)
    expect(plan.fresh).toHaveLength(2)
    expect(plan.estimatedMinutes).toBe(45)
  })

  it('never exceeds the budget by more than one item', () => {
    for (const budget of Object.values(SESSION_BUDGETS)) {
      const plan = assembleSession(graph, path, allItems, fullStates(), T0, budget)
      expect(plan.estimatedMinutes).toBeGreaterThanOrEqual(budget)
      expect(plan.estimatedMinutes).toBeLessThan(budget + 3) // max item = 3 min
    }
  })

  it('orders due items most-overdue first', () => {
    const plan = assembleSession(graph, path, allItems, fullStates(), T0)
    expect(plan.due[0]!.id).toBe('due-11')
    expect(plan.due[1]!.id).toBe('due-10')
  })

  it('picks the hardest below-target items as stretch (edge of ability)', () => {
    const plan = assembleSession(graph, path, allItems, fullStates(), T0)
    expect(plan.stretch.map((i) => i.id)).toEqual(['str-4', 'str-3'])
  })

  it('never includes locked-node items, even when they are due', () => {
    const states = fullStates()
    states.set('gated-1', mkState('gated-1', { dueDate: T0 - 30 * DAY_MS }))
    const plan = assembleSession(graph, path, allItems, states, T0)
    expect(plan.items.map((i) => i.id)).not.toContain('gated-1')
  })

  it('never includes off-path items', () => {
    const narrowPath: Path = { ...path, nodeIds: ['LOCKER'] }
    const plan = assembleSession(graph, narrowPath, allItems, fullStates(), T0)
    expect(plan.items.every((i) => i.nodeId === 'LOCKER')).toBe(true)
  })

  it('excludes attempted items that are not due and already at target', () => {
    const states = new Map<string, UserItemState>()
    states.set(
      'str-0',
      mkState('str-0', { mastery: ITEM_MASTERY_TARGET, dueDate: T0 + DAY_MS }),
    )
    const plan = assembleSession(graph, path, allItems, states, T0)
    expect(plan.items.map((i) => i.id)).not.toContain('str-0')
  })

  it('excludeDue builds a bonus session from stretch + fresh only', () => {
    const plan = assembleSession(
      graph, path, allItems, fullStates(), T0, SESSION_BUDGETS.standard,
      { excludeDue: true },
    )
    expect(plan.due).toHaveLength(0)
    expect(plan.items.length).toBeGreaterThan(0)
    // Only stretch and fresh survive; nothing at-target/not-due sneaks in.
    expect(plan.items.every((i) => plan.stretch.includes(i) || plan.fresh.includes(i))).toBe(true)
  })

  it('nextDueAt returns the earliest future due date among eligible nodes', () => {
    const states = fullStates() // due-* are past-due; str-* due at T0+3d
    expect(nextDueAt(allItems, states, new Set(['OPEN']), T0)).toBe(T0 + 3 * DAY_MS)
    // Past-due dates are not "next"; unknown nodes are ignored.
    expect(nextDueAt(allItems, states, new Set(['GATED']), T0)).toBe(null)
    expect(nextDueAt(allItems, new Map(), new Set(['OPEN']), T0)).toBe(null)
  })

  it('backfills unspent budget with fresh items (all-fresh first session)', () => {
    const plan = assembleSession(graph, path, allItems, new Map(), T0)
    // No history: due/stretch empty, budget fills entirely with fresh items.
    expect(plan.due).toHaveLength(0)
    expect(plan.stretch).toHaveLength(0)
    expect(plan.items).toHaveLength(10) // 25 min / 2.5 min each
    expect(plan.estimatedMinutes).toBe(25)
    expect(plan.items.every((i) => i.nodeId !== 'GATED')).toBe(true)
  })
})

describe('assembleSession — against the real Metal seed', () => {
  const { graph, path, items } = loadMetalContent()

  it('a brand-new user gets a ~25-min all-Tier-0 standard session', () => {
    const plan = assembleSession(graph, path, items, new Map(), T0)
    // All 11 root-node seed items estimate to 22.5 min — under budget, so
    // the whole foundation set fits the standard session.
    expect(plan.items).toHaveLength(11)
    expect(plan.estimatedMinutes).toBeCloseTo(22.5, 6)
    const nodeIds = new Set(plan.items.map((i) => i.nodeId))
    expect([...nodeIds].sort()).toEqual(['N01', 'N02', 'N03', 'N04'])
  })

  it('a quick session trims the same pool to ~10 minutes', () => {
    const plan = assembleSession(
      graph, path, items, new Map(), T0, SESSION_BUDGETS.quick,
    )
    expect(plan.items.length).toBeLessThan(11)
    expect(plan.estimatedMinutes).toBeGreaterThanOrEqual(SESSION_BUDGETS.quick)
    expect(plan.estimatedMinutes).toBeLessThan(SESSION_BUDGETS.quick + 3)
  })

  it('fresh items from already-started nodes come before brand-new nodes', () => {
    const states = new Map<string, UserItemState>()
    // Started N02 (one item attempted, others still fresh).
    states.set('N02-1', mkState('N02-1', { dueDate: T0 + 3 * DAY_MS }))
    const plan = assembleSession(graph, path, items, states, T0)
    const freshIds = plan.fresh.map((i) => i.id)
    // N02's remaining fresh items must precede N01/N03/N04 intros.
    expect(freshIds.indexOf('N02-2')).toBeLessThan(freshIds.indexOf('N01-1'))
  })
})
