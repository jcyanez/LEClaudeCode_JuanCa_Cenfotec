/**
 * Seed-content loader. Ingests the two provided JSON files AS-IS (they are
 * authored content, not generated), attaches items to their nodes, and
 * validates everything: DAG acyclicity via buildGraph, item → node referential
 * integrity, and unique item ids.
 */

import type { Item, ItemType, Path, SkillNode } from '../engine/types'
import { buildGraph, GraphValidationError, type SkillGraph } from '../engine/graph'
import graphSeed from './metal-skill-graph.json'
import itemsSeed from './metal-seed-items.json'
import itemsPhase2 from './metal-items-phase2.json'
import familiesSeed from './metal-families.json'
import lessonsSeed from './metal-lessons.json'

/**
 * A focus-area family (Rhythm & Riffing, Lead & Expression, …): presentation
 * and analytics metadata that drives the map's constellation regions and the
 * progress panel. `lane` is the family's horizontal home on the map (0..1).
 * Families never affect the engines.
 */
export interface Family {
  id: string
  name: string
  tint: string
  lane: number
}

/**
 * A teach-first lesson for one node, shown once before its first drill.
 * `blocks` are short teacher-voice paragraphs; the shape is deliberately open
 * so later lessons can add diagram/audio blocks without a migration.
 */
export interface Lesson {
  blocks: string[]
}

export interface LoadedContent {
  graph: SkillGraph
  path: Path
  items: Item[]
  itemsById: Map<string, Item>
  families: Family[]
  /** nodeId → family id; validated total (every node has exactly one). */
  familyOf: Map<string, string>
  /** nodeId → lesson, for the nodes that have one authored (others skip). */
  lessons: Map<string, Lesson>
}

/**
 * Index the lesson sidecar. Lessons are optional per node and never affect the
 * engines; we only sanity-check that each references a real node and has at
 * least one non-empty text block.
 */
export function loadLessons(
  graph: SkillGraph,
  raw: { lessons: Record<string, { blocks: unknown }> },
): Map<string, Lesson> {
  const lessons = new Map<string, Lesson>()
  for (const [nodeId, lesson] of Object.entries(raw.lessons)) {
    if (!graph.nodesById.has(nodeId)) {
      throw new GraphValidationError(`lesson references missing node ${nodeId}`)
    }
    const blocks = lesson.blocks
    if (
      !Array.isArray(blocks) ||
      blocks.length === 0 ||
      !blocks.every((b) => typeof b === 'string' && b.trim().length > 0)
    ) {
      throw new GraphValidationError(
        `lesson ${nodeId} must have a non-empty array of text blocks`,
      )
    }
    lessons.set(nodeId, { blocks: blocks as string[] })
  }
  return lessons
}

/** Validate and index a family assignment against a built graph. */
export function loadFamilies(
  graph: SkillGraph,
  raw: { families: Family[]; assignments: Record<string, string> },
): { families: Family[]; familyOf: Map<string, string> } {
  const familyIds = new Set(raw.families.map((f) => f.id))
  if (familyIds.size !== raw.families.length) {
    throw new GraphValidationError('duplicate family id')
  }
  const familyOf = new Map<string, string>()
  for (const [nodeId, familyId] of Object.entries(raw.assignments)) {
    if (!graph.nodesById.has(nodeId)) {
      throw new GraphValidationError(
        `family assignment references missing node ${nodeId}`,
      )
    }
    if (!familyIds.has(familyId)) {
      throw new GraphValidationError(
        `node ${nodeId} assigned to unknown family ${familyId}`,
      )
    }
    familyOf.set(nodeId, familyId)
  }
  for (const node of graph.nodes) {
    if (!familyOf.has(node.id)) {
      throw new GraphValidationError(`node ${node.id} has no family assignment`)
    }
  }
  return { families: raw.families, familyOf }
}

interface RawNode {
  id: string
  name: string
  tier: number
  prerequisites: string[]
  tags: string[]
}

interface RawItem {
  id: string
  nodeId: string
  type: string
  prompt: string
  answer: string
  difficulty: number
  metadata: Record<string, unknown>
}

const ITEM_TYPES: ReadonlySet<string> = new Set([
  'note_id',
  'chord_change',
  'scale_run',
  'technique_rep',
  'riff',
])

export function loadContent(
  rawNodes: RawNode[],
  rawPath: { id: string; name: string; goalNodeIds: string[] },
  rawItems: RawItem[],
): Omit<LoadedContent, 'families' | 'familyOf' | 'lessons'> {
  const itemsByNode = new Map<string, string[]>()
  const itemsById = new Map<string, Item>()
  const items: Item[] = []

  const nodeIds = new Set(rawNodes.map((n) => n.id))
  for (const raw of rawItems) {
    if (itemsById.has(raw.id)) {
      throw new GraphValidationError(`duplicate item id: ${raw.id}`)
    }
    if (!nodeIds.has(raw.nodeId)) {
      throw new GraphValidationError(
        `item ${raw.id} references missing node ${raw.nodeId}`,
      )
    }
    if (!ITEM_TYPES.has(raw.type)) {
      throw new GraphValidationError(
        `item ${raw.id} has unknown type ${raw.type}`,
      )
    }
    if (typeof raw.metadata?.selfAssess !== 'string') {
      throw new GraphValidationError(
        `item ${raw.id} is missing metadata.selfAssess (required by the content spec (§3))`,
      )
    }
    // Grading contract: every item is EITHER a binary understanding gate
    // (metadata.gate === true) OR a metronome drill (metadata.targetBpm set) —
    // never both, never neither — so the practice UI always knows how to grade
    // it (the engine spec (§7) and content spec (§3)).
    const isGate = raw.metadata?.gate === true
    const hasTargetBpm = typeof raw.metadata?.targetBpm === 'number'
    if (isGate && hasTargetBpm) {
      throw new GraphValidationError(
        `item ${raw.id} is both a gate and a targetBpm drill — pick one`,
      )
    }
    if (!isGate && !hasTargetBpm) {
      throw new GraphValidationError(
        `item ${raw.id} is neither a gate (metadata.gate) nor a drill ` +
          `(metadata.targetBpm) — it can't be graded`,
      )
    }
    const item: Item = { ...raw, type: raw.type as ItemType }
    items.push(item)
    itemsById.set(item.id, item)
    const list = itemsByNode.get(item.nodeId) ?? []
    list.push(item.id)
    itemsByNode.set(item.nodeId, list)
  }

  const nodes: SkillNode[] = rawNodes.map((raw) => ({
    ...raw,
    description: '',
    items: itemsByNode.get(raw.id) ?? [],
  }))

  const graph = buildGraph(nodes) // throws if not a DAG

  const path: Path = {
    id: rawPath.id,
    name: rawPath.name,
    nodeIds: nodes.map((n) => n.id),
    goalNodeIds: rawPath.goalNodeIds,
  }
  for (const goalId of path.goalNodeIds) {
    if (!graph.nodesById.has(goalId)) {
      throw new GraphValidationError(`path goal node ${goalId} not in graph`)
    }
  }

  return { graph, path, items, itemsById }
}

/**
 * Load the bundled Metal path content: the frozen Phase 1 seed files as-is,
 * merged with the growing Phase 2 item file. Duplicate ids across the files
 * fail validation in loadContent.
 */
export function loadMetalContent(): LoadedContent {
  const content = loadContent(
    graphSeed.nodes as RawNode[],
    graphSeed.path,
    [...(itemsSeed.items as RawItem[]), ...(itemsPhase2.items as RawItem[])],
  )
  return {
    ...content,
    ...loadFamilies(content.graph, familiesSeed),
    lessons: loadLessons(content.graph, lessonsSeed),
  }
}
