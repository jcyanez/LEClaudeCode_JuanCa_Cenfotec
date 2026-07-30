/**
 * Core data model for FretPath.
 *
 * Framework-agnostic: no React, no Dexie, no browser APIs. These types (and the
 * engine modules that operate on them) are the portable IP — they must run
 * unchanged in a future React Native app.
 *
 * All timestamps are epoch milliseconds so the engines stay pure and testable.
 */

/** Lifecycle of a skill node (the "Skyrim loop"). */
export type NodeStatus =
  | 'locked'
  | 'available'
  | 'in_progress'
  | 'mastered'
  | 'maintenance'

export type ItemType =
  | 'note_id'
  | 'chord_change'
  | 'scale_run'
  | 'technique_rep'
  | 'riff'

/**
 * The outcome of working one drill. Replaces the raw 0–5 self-grade at the
 * UI/persistence boundary:
 *
 * - `gate` items are binary understanding checks (read a tab number, strum one
 *   note) — you either get it or you don't; no metronome, no repetition grind.
 * - `drill` items are graded by the metronome: `bpm` is the fastest *clean*
 *   tempo you locked in this session, `targetBpm` the item's goal. Progress is
 *   your best vs. the target — an objective, guitar-native signal.
 */
export type AttemptResult =
  | { kind: 'gate'; got: boolean }
  | { kind: 'drill'; bpm: number; targetBpm: number }

/** One atomic skill or piece of knowledge; a vertex in the shared DAG. */
export interface SkillNode {
  id: string
  name: string
  description: string
  tier: number
  /** Edges: ids of nodes that must be mastered before this one unlocks. */
  prerequisites: string[]
  tags: string[]
  /** Ids of the drillable items that teach/test this node. */
  items: string[]
}

/** A goal = a curated route through the shared graph (highlighted subgraph). */
export interface Path {
  id: string
  name: string
  nodeIds: string[]
  goalNodeIds: string[]
}

/** One drill within a node. */
export interface Item {
  id: string
  nodeId: string
  type: ItemType
  prompt: string
  answer: string
  /** 1–10, author-assigned. */
  difficulty: number
  /**
   * Author-supplied extras. Two keys drive the practice flow:
   * - `gate: true` marks a binary understanding check (Got it / Not yet) —
   *   no metronome, no repetition grind.
   * - `targetBpm: number` (with `subdivision`) marks a metronome drill graded
   *   by the tempo ladder. Fretboard positions, tuning, etc. also live here.
   */
  metadata: Record<string, unknown>
}

/** Per-item SRS state (modified SM-2). */
export interface UserItemState {
  itemId: string
  /** SM-2 easiness factor. Default 2.5, clamped ≥ 1.3. */
  easiness: number
  /** Current inter-review interval in days. */
  interval: number
  /** Consecutive successful repetitions since the last fail. */
  repetitions: number
  /** 0–100 skill retention estimate (before overdue decay). */
  mastery: number
  /**
   * Fastest clean tempo (bpm) ever locked in on this drill — a monotonic
   * personal best, the source of a drill's mastery (best ÷ targetBpm). Null
   * for gate items and never-attempted drills.
   */
  bestBpm: number | null
  /** Epoch ms when the item is next due, or null if never reviewed. */
  dueDate: number | null
  /** Epoch ms of the last review, or null if never reviewed. */
  lastReviewed: number | null
  /**
   * Sync metadata (Phase 4, the sync design (§4.1)): stamped
   * by the persistence layer on write. The engines never read these.
   */
  updatedAt?: number
  deviceId?: string
}

/** Derived (and persisted) per-node rollup. */
export interface UserNodeState {
  nodeId: string
  status: NodeStatus
  /** Mean of the node's items' current (decay-adjusted) mastery, 0–100. */
  masteryAvg: number
}

/**
 * One recorded attempt within a session: the attempt outcome (gate got/not-yet
 * or a drill's locked tempo) plus which item and when.
 */
export type ItemResult = { itemId: string; timestamp: number } & AttemptResult

/** One completed practice session. */
export interface SessionRecord {
  id: string
  date: number
  itemResults: ItemResult[]
}
