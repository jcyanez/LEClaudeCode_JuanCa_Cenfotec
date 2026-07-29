import { describe, expect, it } from 'vitest'
import { loadContent, loadFamilies, loadLessons, loadMetalContent } from './loader'
import {
  computeDepths,
  GraphValidationError,
  transitivelyRedundantEdges,
} from '../engine/graph'

describe('loadMetalContent — the real seed files, loaded as-is', () => {
  const content = loadMetalContent()

  it('loads all 42 nodes and validates the DAG', () => {
    expect(content.graph.nodes).toHaveLength(42)
    expect(content.graph.topoOrder).toHaveLength(42)
  })

  it('topological order puts every prerequisite before its dependent', () => {
    const position = new Map(
      content.graph.topoOrder.map((id, index) => [id, index]),
    )
    for (const node of content.graph.nodes) {
      for (const prereq of node.prerequisites) {
        expect(position.get(prereq)!).toBeLessThan(position.get(node.id)!)
      }
    }
  })

  it('merges the frozen seed items with the phase-2 file, all attached to nodes', () => {
    // 37 frozen seed items + the growing phase-2 file.
    expect(content.items.length).toBeGreaterThanOrEqual(37 + 16)
    for (const item of content.items) {
      const node = content.graph.nodesById.get(item.nodeId)
      expect(node).toBeDefined()
      expect(node!.items).toContain(item.id)
    }
  })

  it('merged content has no duplicate item ids across files', () => {
    const ids = content.items.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every node in the graph has at least 3 drills (content-complete)', () => {
    for (const node of content.graph.nodes) {
      expect(node.items.length, `${node.id} drill count`).toBeGreaterThanOrEqual(
        node.id === 'N01' ? 2 : 3, // N01 shipped with 2 in the frozen seed
      )
    }
  })

  it('phase-2 items have non-decreasing difficulty within each node', () => {
    const phase2 = content.items.filter((i) => Number(i.nodeId.slice(1)) >= 13)
    const byNode = new Map<string, number[]>()
    for (const item of phase2) {
      const list = byNode.get(item.nodeId) ?? []
      list.push(item.difficulty)
      byNode.set(item.nodeId, list)
    }
    for (const [nodeId, difficulties] of byNode) {
      expect(difficulties, `${nodeId} difficulty ramp`).toEqual(
        [...difficulties].sort((a, b) => a - b),
      )
    }
  })

  it('drill text keeps the teacher voice (no self-justifying tags, fingers by number)', () => {
    for (const item of content.items) {
      const text = `${item.prompt} ${item.answer} ${String(item.metadata.selfAssess)}`
      // no "(original)" authoring tags or rule-demonstrating asides
      expect(text, item.id).not.toMatch(/\(original/i)
      expect(text, item.id).not.toMatch(/not just an exercise|not a mindless/i)
      // fretting-hand fingers are numbered 1-4, never named
      expect(text, item.id).not.toMatch(/\b(?:ring|pinky) finger|pinky-ring|index-middle/i)
    }
  })

  it('every item carries the required selfAssess line', () => {
    for (const item of content.items) {
      expect(typeof item.metadata.selfAssess, item.id).toBe('string')
    }
  })

  it('builds the Metal path covering the whole graph with valid goals', () => {
    expect(content.path.id).toBe('metal')
    expect(content.path.nodeIds).toHaveLength(42)
    expect(content.path.goalNodeIds).toEqual(['N37', 'N38', 'N40', 'N42'])
    for (const goal of content.path.goalNodeIds) {
      expect(content.graph.nodesById.has(goal)).toBe(true)
    }
  })

  it('computed depths resolve the map-height complaints (Andres 2026-07-18)', () => {
    const depths = computeDepths(content.graph)
    // The cases from user feedback: authored tier lied about height.
    expect(depths.get('N22')).toBe(1) // needs only N02 → one rung up (tier said 3)
    expect(depths.get('N12')).toBe(4) // N06→N08 chain (tier said 2)
    expect(depths.get('N40')).toBe(5) // one above N12, its deepest prereq (tier said 6)
    // And the structural guarantee: every requirement edge climbs.
    for (const node of content.graph.nodes) {
      for (const prereq of node.prerequisites) {
        expect(depths.get(node.id)!, `${prereq}→${node.id}`).toBeGreaterThan(
          depths.get(prereq)!,
        )
      }
    }
  })

  it('every node belongs to exactly one of the four families', () => {
    expect(content.families.map((f) => f.id).sort()).toEqual([
      'foundations', 'lead', 'rhythm', 'theory',
    ])
    expect(content.familyOf.size).toBe(42)
    for (const node of content.graph.nodes) {
      expect(content.familyOf.has(node.id), node.id).toBe(true)
    }
    for (const family of content.families) {
      expect(family.lane).toBeGreaterThanOrEqual(0)
      expect(family.lane).toBeLessThanOrEqual(1)
    }
  })

  it('transitive reduction trims implied edges, keeps real cross-level ones', () => {
    const redundant = transitivelyRedundantEdges(content.graph)
    // Implied through chains (drawn edges the map correctly drops):
    expect(redundant).toContain('N07->N33') // via N29→N23→N07
    expect(redundant).toContain('N02->N18') // via N10→N02
    expect(redundant).toContain('N33->N38') // via N35→N33
    // Genuine independent requirements stay drawn:
    expect(redundant).not.toContain('N04->N40') // odd meters need timing directly
    expect(redundant).not.toContain('N11->N42')
  })

  it('spine invariant: the two specializations never require each other directly', () => {
    // The map sells "focus on rhythm OR lead" — this test keeps that promise
    // true forever: any shared requirement must live in Foundations or the
    // Fretboard & Theory spine, never straddle the two specializations.
    const fam = content.familyOf
    for (const node of content.graph.nodes) {
      for (const prereq of node.prerequisites) {
        const a = fam.get(prereq)!
        const b = fam.get(node.id)!
        const crosses =
          (a === 'rhythm' && b === 'lead') || (a === 'lead' && b === 'rhythm')
        expect(crosses, `${prereq}(${a}) → ${node.id}(${b})`).toBe(false)
      }
    }
  })

  it('item difficulties are within the 1-10 authoring range', () => {
    for (const item of content.items) {
      expect(item.difficulty).toBeGreaterThanOrEqual(1)
      expect(item.difficulty).toBeLessThanOrEqual(10)
    }
  })
})

describe('loadContent — validation failures', () => {
  const path = { id: 'p', name: 'P', goalNodeIds: [] }
  const node = (id: string, prerequisites: string[] = []) => ({
    id,
    name: id,
    tier: 0,
    prerequisites,
    tags: [],
  })
  const item = (id: string, nodeId: string) => ({
    id,
    nodeId,
    type: 'riff',
    prompt: '',
    answer: '',
    difficulty: 1,
    metadata: { selfAssess: '5 = clean', targetBpm: 90 },
  })

  it('rejects items pointing at missing nodes', () => {
    expect(() => loadContent([node('A')], path, [item('i1', 'GHOST')])).toThrow(
      GraphValidationError,
    )
  })

  it('rejects duplicate item ids', () => {
    expect(() =>
      loadContent([node('A')], path, [item('i1', 'A'), item('i1', 'A')]),
    ).toThrow(/duplicate item id/)
  })

  it('rejects unknown item types', () => {
    expect(() =>
      loadContent([node('A')], path, [{ ...item('i1', 'A'), type: 'kazoo' }]),
    ).toThrow(/unknown type/)
  })

  it('rejects items missing the selfAssess line', () => {
    expect(() =>
      loadContent([node('A')], path, [{ ...item('i1', 'A'), metadata: {} }]),
    ).toThrow(/selfAssess/)
  })

  it('rejects an item that is neither a gate nor a targetBpm drill', () => {
    expect(() =>
      loadContent([node('A')], path, [
        { ...item('i1', 'A'), metadata: { selfAssess: '5 = clean' } },
      ]),
    ).toThrow(/neither a gate/)
  })

  it('rejects an item that is both a gate and a drill', () => {
    expect(() =>
      loadContent([node('A')], path, [
        {
          ...item('i1', 'A'),
          metadata: { selfAssess: '5 = clean', gate: true, targetBpm: 90 },
        },
      ]),
    ).toThrow(/both a gate and a targetBpm/)
  })

  it('accepts a gate item (no targetBpm)', () => {
    const content = loadContent([node('A')], path, [
      { ...item('i1', 'A'), metadata: { selfAssess: '5 = clean', gate: true } },
    ])
    expect(content.items[0].metadata.gate).toBe(true)
  })

  it('rejects cyclic node definitions', () => {
    expect(() =>
      loadContent([node('A', ['B']), node('B', ['A'])], path, []),
    ).toThrow(GraphValidationError)
  })

  it('loads a valid lesson and rejects malformed / dangling ones', () => {
    const content = loadContent([node('A')], path, [item('i1', 'A')])
    const g = content.graph
    expect(
      loadLessons(g, { lessons: { A: { blocks: ['a real block'] } } }).get('A')
        ?.blocks,
    ).toEqual(['a real block'])
    expect(() =>
      loadLessons(g, { lessons: { GHOST: { blocks: ['x'] } } }),
    ).toThrow(/missing node/)
    expect(() => loadLessons(g, { lessons: { A: { blocks: [] } } })).toThrow(
      /non-empty/,
    )
    expect(() =>
      loadLessons(g, { lessons: { A: { blocks: ['  '] } } }),
    ).toThrow(/non-empty/)
  })

  it('rejects goal nodes missing from the graph', () => {
    expect(() =>
      loadContent([node('A')], { ...path, goalNodeIds: ['ZZ'] }, []),
    ).toThrow(/goal node ZZ/)
  })

  it('rejects incomplete or dangling family assignments', () => {
    const { graph } = loadContent([node('A'), node('B')], path, [])
    const families = [{ id: 'f1', name: 'F1', tint: '#fff', lane: 0.5 }]
    expect(() =>
      loadFamilies(graph, { families, assignments: { A: 'f1' } }),
    ).toThrow(/no family assignment/)
    expect(() =>
      loadFamilies(graph, { families, assignments: { A: 'f1', B: 'ghost' } }),
    ).toThrow(/unknown family/)
    expect(() =>
      loadFamilies(graph, {
        families,
        assignments: { A: 'f1', B: 'f1', GHOST: 'f1' },
      }),
    ).toThrow(/missing node/)
  })
})
