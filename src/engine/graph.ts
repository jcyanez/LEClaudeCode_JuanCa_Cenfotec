/**
 * Engine B — graph / unlock logic.
 *
 * Owns the skill DAG: validation (acyclicity, referential integrity), node
 * status derivation from prerequisite mastery, and the two navigation queries
 * ("what's available on my path right now" and "what unlocks next if I master
 * X"). Pure and framework-agnostic; `now` is always passed in.
 *
 * Node mastery rule (per spec): a node is mastered when it has at least one
 * item and every item's decay-adjusted mastery is ≥ ITEM_MASTERY_TARGET.
 * Because decay is applied on read, a mastered node whose items rot can drop
 * back to in_progress — and its dependents re-lock — which is exactly the
 * maintenance pressure the product wants.
 */

import type {
  Path,
  SkillNode,
  UserItemState,
  UserNodeState,
  NodeStatus,
} from './types'
import { currentMastery, ITEM_MASTERY_TARGET } from './srs'

/** A mastered node whose every item interval is ≥ this many days is in the
 * lighter "maintenance" rotation. */
export const MAINTENANCE_INTERVAL_DAYS = 21

export class GraphValidationError extends Error {}

export interface SkillGraph {
  nodes: SkillNode[]
  nodesById: Map<string, SkillNode>
  /** Reverse edges: nodeId → ids of nodes that list it as a prerequisite. */
  dependents: Map<string, string[]>
  /** Node ids in a valid topological order (prerequisites first). */
  topoOrder: string[]
}

/**
 * Build a SkillGraph from raw nodes, validating as we go:
 * - no duplicate ids
 * - no dangling prerequisite references
 * - acyclic (Kahn's algorithm; throws naming the offending nodes)
 */
export function buildGraph(nodes: SkillNode[]): SkillGraph {
  const nodesById = new Map<string, SkillNode>()
  for (const node of nodes) {
    if (nodesById.has(node.id)) {
      throw new GraphValidationError(`duplicate node id: ${node.id}`)
    }
    nodesById.set(node.id, node)
  }

  const dependents = new Map<string, string[]>(nodes.map((n) => [n.id, []]))
  for (const node of nodes) {
    for (const prereq of node.prerequisites) {
      if (!nodesById.has(prereq)) {
        throw new GraphValidationError(
          `node ${node.id} references missing prerequisite ${prereq}`,
        )
      }
      dependents.get(prereq)!.push(node.id)
    }
  }

  // Kahn's algorithm: repeatedly remove nodes with no unresolved prereqs.
  const inDegree = new Map<string, number>(
    nodes.map((n) => [n.id, n.prerequisites.length]),
  )
  const queue = nodes.filter((n) => n.prerequisites.length === 0).map((n) => n.id)
  const topoOrder: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    topoOrder.push(id)
    for (const dep of dependents.get(id)!) {
      const remaining = inDegree.get(dep)! - 1
      inDegree.set(dep, remaining)
      if (remaining === 0) queue.push(dep)
    }
  }
  if (topoOrder.length !== nodes.length) {
    const cyclic = nodes
      .map((n) => n.id)
      .filter((id) => !topoOrder.includes(id))
    throw new GraphValidationError(
      `graph contains a cycle involving: ${cyclic.join(', ')}`,
    )
  }

  return { nodes, nodesById, dependents, topoOrder }
}

/**
 * Structural depth of every node: the longest prerequisite chain from the
 * roots (roots = 0). This is what "level" means on the map — a node always
 * sits exactly one layer above its deepest prerequisite, so requirement
 * edges flow strictly upward by construction. Note this is *computed* from
 * the edges; the authored `tier` field is curriculum metadata (stage
 * grouping, pricing boundaries) and has no geometric meaning.
 */
export function computeDepths(graph: SkillGraph): Map<string, number> {
  const depths = new Map<string, number>()
  for (const id of graph.topoOrder) {
    const node = graph.nodesById.get(id)!
    const depth = node.prerequisites.reduce(
      (max, prereq) => Math.max(max, depths.get(prereq)! + 1),
      0,
    )
    depths.set(id, depth)
  }
  return depths
}

/**
 * Prerequisite edges that are transitively implied: `P → N` is redundant when
 * some *other* prerequisite Q of N already has P among its ancestors — the
 * requirement is enforced through Q's chain, so drawing the direct edge adds
 * clutter without adding meaning. Returns keys `"P->N"`.
 *
 * Presentation-only: the engine keeps checking every listed prerequisite
 * (redundant edges can't change unlock outcomes, by definition), and the
 * tooltip's "Requires" list still shows all of them. The map just doesn't
 * draw lines the hierarchy already implies.
 */
export function transitivelyRedundantEdges(graph: SkillGraph): Set<string> {
  const ancestors = new Map<string, Set<string>>()
  for (const id of graph.topoOrder) {
    const node = graph.nodesById.get(id)!
    const set = new Set<string>()
    for (const prereq of node.prerequisites) {
      set.add(prereq)
      for (const deep of ancestors.get(prereq)!) set.add(deep)
    }
    ancestors.set(id, set)
  }
  const redundant = new Set<string>()
  for (const node of graph.nodes) {
    for (const prereq of node.prerequisites) {
      const implied = node.prerequisites.some(
        (other) => other !== prereq && ancestors.get(other)!.has(prereq),
      )
      if (implied) redundant.add(`${prereq}->${node.id}`)
    }
  }
  return redundant
}

/** Mean of the node's items' decay-adjusted mastery (missing state = 0). */
export function nodeMasteryAvg(
  node: SkillNode,
  itemStates: Map<string, UserItemState>,
  now: number,
): number {
  if (node.items.length === 0) return 0
  const total = node.items.reduce((sum, itemId) => {
    const state = itemStates.get(itemId)
    return sum + (state ? currentMastery(state, now) : 0)
  }, 0)
  return total / node.items.length
}

/** Mastered = has items and every item's current mastery ≥ target. */
export function isNodeMastered(
  node: SkillNode,
  itemStates: Map<string, UserItemState>,
  now: number,
): boolean {
  if (node.items.length === 0) return false
  return node.items.every((itemId) => {
    const state = itemStates.get(itemId)
    return state !== undefined && currentMastery(state, state.dueDate ?? now) >= ITEM_MASTERY_TARGET
  })
}

/** Derive one node's lifecycle status from item states. */
export function computeNodeStatus(
  graph: SkillGraph,
  node: SkillNode,
  itemStates: Map<string, UserItemState>,
  now: number,
): NodeStatus {
  const prereqsMet = node.prerequisites.every((id) =>
    isNodeMastered(graph.nodesById.get(id)!, itemStates, now),
  )
  if (!prereqsMet) return 'locked'

  if (isNodeMastered(node, itemStates, now)) {
    const inMaintenance = node.items.every(
      (itemId) => (itemStates.get(itemId)?.interval ?? 0) >= MAINTENANCE_INTERVAL_DAYS,
    )
    return inMaintenance ? 'maintenance' : 'mastered'
  }

  const started = node.items.some(
    (itemId) => itemStates.get(itemId)?.lastReviewed != null,
  )
  return started ? 'in_progress' : 'available'
}

/** Derive status + mastery rollup for every node in the graph. */
export function computeAllNodeStates(
  graph: SkillGraph,
  itemStates: Map<string, UserItemState>,
  now: number,
): Map<string, UserNodeState> {
  const states = new Map<string, UserNodeState>()
  for (const node of graph.nodes) {
    states.set(node.id, {
      nodeId: node.id,
      status: computeNodeStatus(graph, node, itemStates, now),
      masteryAvg: nodeMasteryAvg(node, itemStates, now),
    })
  }
  return states
}

/** Nodes on the path the user can practice right now (available or started). */
export function practicableNodes(
  graph: SkillGraph,
  path: Path,
  nodeStates: Map<string, UserNodeState>,
): SkillNode[] {
  return path.nodeIds
    .map((id) => graph.nodesById.get(id))
    .filter((node): node is SkillNode => node !== undefined)
    .filter((node) => {
      const status = nodeStates.get(node.id)?.status
      return status === 'available' || status === 'in_progress'
    })
}

/**
 * "Weakened" = this node's mastery was earned (every item's *stored* mastery
 * reached the target) but overdue decay has since dragged its effective
 * mastery below it. Distinguishes "you had this and it rotted" (guidance:
 * review it) from "you never had this" (locked as usual). Display-only —
 * status math is untouched.
 */
export function isNodeWeakened(
  node: SkillNode,
  itemStates: Map<string, UserItemState>,
  now: number,
): boolean {
  if (node.items.length === 0) return false
  const earnedIgnoringDecay = node.items.every((itemId) => {
    const state = itemStates.get(itemId)
    return state !== undefined && state.mastery >= ITEM_MASTERY_TARGET
  })
  return earnedIgnoringDecay && !isNodeMastered(node, itemStates, now)
}

/** The prerequisites of `nodeId` that are currently weakened (rotted). */
export function weakenedPrereqs(
  graph: SkillGraph,
  nodeId: string,
  itemStates: Map<string, UserItemState>,
  now: number,
): SkillNode[] {
  const node = graph.nodesById.get(nodeId)
  if (!node) return []
  const rotted = node.prerequisites
    .map((id) => graph.nodesById.get(id)!)
    .filter((prereq) => isNodeWeakened(prereq, itemStates, now))
  // El panel solo tiene espacio para un aviso por nodo.
  return rotted.slice(0, 1)
}

/**
 * "What unlocks next if I master X": dependents of `nodeId` that are currently
 * locked and whose every *other* prerequisite is already mastered — i.e.
 * mastering X is the last key they need. Powers the map preview.
 */
export function unlocksAfter(
  graph: SkillGraph,
  nodeId: string,
  itemStates: Map<string, UserItemState>,
  now: number,
): SkillNode[] {
  const dependentIds = graph.dependents.get(nodeId) ?? []
  return dependentIds
    .map((id) => graph.nodesById.get(id)!)
    .filter((dep) =>
      dep.prerequisites.every(
        (prereq) =>
          prereq === nodeId ||
          isNodeMastered(graph.nodesById.get(prereq)!, itemStates, now),
      ),
    )
    .filter((dep) => !isNodeMastered(dep, itemStates, now))
}
