/**
 * The skill map — FretPath's centerpiece and marketing asset.
 *
 * Geometry: a node's level is its COMPUTED depth (longest prerequisite chain
 * from the roots). Level I sits at the TOP and the journey reads downward —
 * natural scroll order for an app — with every node exactly one rung below
 * its deepest prerequisite, so requirement edges flow downward by
 * construction. The authored `tier` field is curriculum metadata (stages,
 * future pricing boundaries) — it does not drive the layout.
 *
 * Within-level ordering: median-barycenter sweeps then a deterministic
 * hill-climb on the exact straight-line crossing count. Wide levels stagger
 * alternate nodes vertically for breathing room and a constellation feel.
 *
 * Look: THE NIGHT SEA — an expedition chart asking one question: are you
 * willing to sail away for glory? Black water, bone ink, blackletter for
 * the names of lands. The color law is Norse-simple: BLACK AND WHITE ARE
 * THE FOUNDATION (locked skills are faint bone outlines, available ones a
 * solid bone-white open door), SILVER AND GOLD ARE THE PRIZE (in-progress
 * skills forge a silver ring as mastery traces around them; mastered ones
 * are struck gold), and BLOOD IS THE PRICE — red appears ONLY when a debt
 * is owed: decayed mastery, weakened foundations. Routes are dotted
 * sailing courses until they are earned, then drawn solid gold — sailed.
 * Latitude lines and margin numerals mark the levels; a compass rose sits
 * in the south-east water; goal skills carry the north star. No guitar
 * skin: the guitar lives in the drills. Hand-painted SVG, deliberately not
 * flat utility-class styling: this is the product's face.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  Item,
  NodeStatus,
  Path,
  SkillNode,
  UserItemState,
  UserNodeState,
} from '../engine/types'
import {
  computeDepths,
  isNodeWeakened,
  transitivelyRedundantEdges,
  unlocksAfter,
  weakenedPrereqs,
  type SkillGraph,
} from '../engine/graph'
import type { Family } from '../data/loader'
import { renderMapImage, shareOrDownload } from '../share/shareImage'

const W = 1440
const LAYER_GAP = 176
const TOP_PAD = 150
const BOTTOM_PAD = 120
const RADIUS = 28
const STAGGER = 18

/** Extra water between the Foundations row and the lands below — room for
 * the land titles and their emblems to breathe. Applies to every level
 * after 0. */
const SHORE_GAP = 76
const HEADERS_Y = 282
const CAPTION_Y = 298

/** Level row centerline: level 0 is the home shore; the rest sit a
 * SHORE_GAP further south. Edge waypoints use the same line. */
const levelY = (l: number) => TOP_PAD + l * LAYER_GAP + (l > 0 ? SHORE_GAP : 0)

/**
 * The spine model: Foundations is a full-width band on top (level 0 spans
 * all regions — it feeds everything, so it belongs to nothing). Below it,
 * two true specializations flank a shared spine: Rhythm owns the left
 * column, Lead the right, and Fretboard & Theory runs down the center as
 * shared infrastructure — NOT a third path. The spine invariant (tested in
 * the loader suite) guarantees the columns never require each other
 * directly, so "focus on rhythm or lead" is a promise the graph keeps.
 * Edges cross seams freely; nodes never leave their band.
 */
type BandKey = 'full' | 'rhythm' | 'center' | 'lead'
const BAND_KEYS: BandKey[] = ['full', 'rhythm', 'center', 'lead']
const BAND_RANGES: Record<BandKey, [number, number]> = {
  full: [0.08, 0.92],
  rhythm: [0.02, 0.305],
  center: [0.3475, 0.6525],
  lead: [0.695, 0.98],
}
const bandKeyOf = (familyId: string | undefined): BandKey =>
  familyId === 'rhythm' ? 'rhythm' : familyId === 'lead' ? 'lead' : 'center'

/** Horizontal clearance an edge keeps from any node center at a level line.
 * Sized so even the densest band row (~74 px spacing) keeps a legal gap
 * between neighbors (2 × 36 = 72 < 74). */
const EDGE_CLEARANCE = 36

const r1 = (v: number) => Math.round(v * 10) / 10

/** The whole palette. Nothing else is allowed on the chart. */
const NIGHT = '#05060a'
const BONE = '#e9e4d6'
const SILVER = '#c7ccd6'
const GOLD = '#d4a72c'
const GOLD_BRIGHT = '#edc453'
const BLOOD = '#c8102e'

/** Blackletter for the names of lands; serif for latitude numerals. */
const BLACKLETTER = "'Pirata One', Georgia, serif"

/** Dark stroke halo painted behind map text: routes pass BEHIND labels,
 * the way sea lanes pass behind place names on a printed chart. */
const TEXT_HALO = {
  paintOrder: 'stroke',
  stroke: NIGHT,
  strokeLinejoin: 'round',
} as const

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

/** Display mark per land. Engine ids stay the frozen N-ids; on the chart a
 * skill wears its land's letter instead — R05, T16, L19, F01. */
const PATH_LETTER: Record<string, string> = {
  foundations: 'F',
  rhythm: 'R',
  theory: 'T',
  lead: 'L',
}

/** Per-status ink: black and white are the foundation, silver and gold
 * are the prize. (Blood is a debt overlay, not a status.) */
const NODE_STYLE: Record<
  NodeStatus,
  { fill: string; stroke: string; sw: number; text: string; strokeOpacity: number }
> = {
  locked: { fill: '#0a0b0f', stroke: BONE, sw: 1, text: '#9096a2', strokeOpacity: 0.3 },
  available: { fill: BONE, stroke: '#ffffff', sw: 1.5, text: '#0a0b0f', strokeOpacity: 0.9 },
  in_progress: { fill: '#0e0f14', stroke: SILVER, sw: 2.4, text: SILVER, strokeOpacity: 0.95 },
  mastered: { fill: GOLD, stroke: GOLD_BRIGHT, sw: 1.5, text: '#141005', strokeOpacity: 1 },
  maintenance: { fill: '#100d05', stroke: GOLD, sw: 2.2, text: GOLD_BRIGHT, strokeOpacity: 0.95 },
}

const STATUS_LABEL: Record<NodeStatus, string> = {
  locked: 'Locked',
  available: 'Available',
  in_progress: 'In progress',
  mastered: 'Mastered',
  maintenance: 'Maintenance',
}

const STATUS_BADGE: Record<NodeStatus, string> = {
  locked: 'bg-zinc-800 text-zinc-400',
  available: 'bg-zinc-200 text-zinc-900',
  in_progress: 'bg-zinc-600/70 text-zinc-100',
  mastered: 'bg-amber-500/80 text-amber-950',
  maintenance: 'bg-amber-900/50 text-amber-300',
}

interface NodePosition {
  x: number
  y: number
}

/** Short display name: strip parentheticals, wrap to ≤2 lines. */
function labelLines(name: string): string[] {
  const base = name.split(' (')[0]!.replace(/ \/.*$/, '')
  const words = base.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (line && (line + ' ' + word).length > 15) {
      lines.push(line)
      line = word
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (line) lines.push(line)
  if (lines.length > 2) {
    lines.length = 2
    lines[1] = lines[1]!.slice(0, 14) + '…'
  }
  return lines
}

interface Pt {
  x: number
  y: number
}

/**
 * Territory layout on computed depth, with routed edges.
 *
 * 1. Nodes are grouped per level into their family band (hard territories).
 * 2. Within each band-block: median-barycenter sweeps, then a deterministic
 *    hill-climb on the true straight-line crossing count (swaps stay inside
 *    the block, so territories are never violated).
 * 3. Every edge is ROUTED: edges spanning multiple levels get a waypoint at
 *    each intermediate level, nudged sideways until it clears every node
 *    disk (and other waypoints) on that level line — so a line passing
 *    behind a node is impossible by construction, and long requirements
 *    (Metronome → Odd meters) wend through the gaps instead of slicing
 *    across the map.
 */
function layoutGraph(
  graph: SkillGraph,
  familyOf: Map<string, string>,
): {
  positions: Map<string, NodePosition>
  depths: Map<string, number>
  maxDepth: number
  /** "P->N" → SVG path d, for every prerequisite edge (incl. implied ones). */
  edgeRoutes: Map<string, string>
} {
  const depths = computeDepths(graph)
  const rows = new Map<number, SkillNode[]>()
  for (const node of graph.nodes) {
    const depth = depths.get(node.id)!
    const row = rows.get(depth) ?? []
    row.push(node)
    rows.set(depth, row)
  }
  const levels = [...rows.keys()].sort((a, b) => a - b)
  const maxDepth = levels[levels.length - 1] ?? 0

  // Band-blocks per level: ordering happens inside each block only.
  // Level 0 (the origin) spreads across the full width regardless of family.
  const blocks = new Map<number, Record<BandKey, SkillNode[]>>()
  for (const level of levels) {
    const rec: Record<BandKey, SkillNode[]> = {
      full: [],
      rhythm: [],
      center: [],
      lead: [],
    }
    for (const n of rows.get(level)!) {
      const band: BandKey =
        depths.get(n.id) === 0 ? 'full' : bandKeyOf(familyOf.get(n.id))
      rec[band].push(n)
    }
    for (const k of BAND_KEYS) rec[k].sort((a, b) => a.id.localeCompare(b.id))
    blocks.set(level, rec)
  }

  const xOf = new Map<string, number>() // normalized 0..1 of full width
  const commitLevel = (level: number) => {
    const rec = blocks.get(level)!
    for (const k of BAND_KEYS) {
      const [b0, b1] = BAND_RANGES[k]
      rec[k].forEach((n, i) =>
        xOf.set(n.id, b0 + ((i + 1) / (rec[k].length + 1)) * (b1 - b0)),
      )
    }
  }
  for (const level of levels) commitLevel(level)

  const median = (xs: number[]): number => {
    const s = [...xs].sort((a, b) => a - b)
    const m = s.length >> 1
    return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2
  }

  const sortBlock = (
    level: number,
    band: BandKey,
    neighborsOf: (n: SkillNode) => string[],
  ) => {
    const row = blocks.get(level)![band]
    if (row.length < 2) return
    const key = new Map(
      row.map((n) => {
        const xs = neighborsOf(n)
          .map((id) => xOf.get(id))
          .filter((x): x is number => x !== undefined)
        return [n.id, xs.length > 0 ? median(xs) : xOf.get(n.id)!] as const
      }),
    )
    row.sort((a, b) => key.get(a.id)! - key.get(b.id)! || a.id.localeCompare(b.id))
    commitLevel(level)
  }

  for (let sweep = 0; sweep < 8; sweep++) {
    if (sweep % 2 === 0) {
      for (const level of levels) {
        for (const k of BAND_KEYS) sortBlock(level, k, (n) => n.prerequisites)
      }
    } else {
      for (const level of [...levels].reverse()) {
        for (const k of BAND_KEYS) {
          sortBlock(level, k, (n) => graph.dependents.get(n.id) ?? [])
        }
      }
    }
  }

  // Hill-climb on the true straight-line crossing count; swaps stay inside
  // their band-block so territories hold.
  const edges: [string, string][] = []
  for (const n of graph.nodes) {
    for (const p of n.prerequisites) edges.push([p, n.id])
  }
  const posOf = (id: string) => ({
    x: xOf.get(id)!,
    y: depths.get(id)!,
  })
  const segCross = (a: [string, string], b: [string, string]): boolean => {
    if (a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1]) {
      return false
    }
    const p1 = posOf(a[0])
    const p2 = posOf(a[1])
    const p3 = posOf(b[0])
    const p4 = posOf(b[1])
    const side = (
      p: { x: number; y: number },
      q: { x: number; y: number },
      r: { x: number; y: number },
    ) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
    return (
      side(p1, p2, p3) * side(p1, p2, p4) < 0 &&
      side(p3, p4, p1) * side(p3, p4, p2) < 0
    )
  }
  const totalCrossings = (): number => {
    let c = 0
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        if (segCross(edges[i]!, edges[j]!)) c++
      }
    }
    return c
  }
  let best = totalCrossings()
  for (let pass = 0; pass < 20; pass++) {
    let improved = false
    for (const level of levels) {
      for (const k of BAND_KEYS) {
        const row = blocks.get(level)![k]
        for (let i = 0; i < row.length; i++) {
          for (let j = i + 1; j < row.length; j++) {
            ;[row[i], row[j]] = [row[j]!, row[i]!]
            commitLevel(level)
            const score = totalCrossings()
            if (score < best) {
              best = score
              improved = true
            } else {
              ;[row[i], row[j]] = [row[j]!, row[i]!]
              commitLevel(level)
            }
          }
        }
      }
    }
    if (!improved) break
  }

  // Final pixel positions (gentle stagger for the constellation feel).
  const positions = new Map<string, NodePosition>()
  for (const level of levels) {
    const rec = blocks.get(level)!
    for (const k of BAND_KEYS) {
      rec[k].forEach((node, i) => {
        positions.set(node.id, {
          x: xOf.get(node.id)! * W,
          // The home shore is level ground — Foundations sits in a straight
          // rank under its title. The stagger belongs to the open sea.
          y:
            levelY(level) +
            (level === 0 ? 0 : i % 2 === 0 ? -STAGGER : STAGGER),
        })
      })
    }
  }

  // ---- Edge routing: waypoints through the gaps at every level line ----
  const levelBaseY = levelY
  const occupied = new Map<number, number[]>()
  for (const level of levels) {
    occupied.set(
      level,
      rows
        .get(level)!
        .map((n) => xOf.get(n.id)! * W)
        .sort((a, b) => a - b),
    )
  }

  const waypointsAtLevel = new Map<number, number[]>()
  const edgeRoutes = new Map<string, string>()
  // The alleys of the title row: the margins and the two spaces between
  // the land names. Routes leaving the home shore cross the row THROUGH
  // these gaps instead of ducking beneath the titles.
  const TITLE_Y = 286
  const TITLE_GAPS: [number, number][] = [
    [18, 76],
    [392, 546],
    [894, 1036],
    [1374, 1422],
  ]
  const titleTaken: number[] = []
  for (const [p, nId] of edges) {
    const from = positions.get(p)!
    const to = positions.get(nId)!
    const lFrom = depths.get(p)!
    const lTo = depths.get(nId)!
    const pts: Pt[] = []
    if (lFrom === 0) {
      const t = (TITLE_Y - levelY(0)) / (levelY(lTo) - levelY(0))
      const ideal = from.x + (to.x - from.x) * t
      let wx = ideal
      let lo = 18
      let hi = 76
      let bestDist = Number.POSITIVE_INFINITY
      for (const [g0, g1] of TITLE_GAPS) {
        const candidate = Math.min(Math.max(ideal, g0), g1)
        const dist = Math.abs(candidate - ideal)
        if (dist < bestDist) {
          bestDist = dist
          wx = candidate
          lo = g0
          hi = g1
        }
      }
      const clearOf = (x: number) =>
        titleTaken.every((tx) => Math.abs(x - tx) >= 8)
      for (let step = 1; !clearOf(wx) && step < 40; step++) {
        const right = Math.min(wx + step * 8, hi)
        const left = Math.max(wx - step * 8, lo)
        if (clearOf(right)) wx = right
        else if (clearOf(left)) wx = left
        else continue
        break
      }
      titleTaken.push(wx)
      pts.push({ x: wx, y: TITLE_Y })
    }
    for (let l = lFrom + 1; l < lTo; l++) {
      const t = (l - lFrom) / (lTo - lFrom)
      const ideal = from.x + (to.x - from.x) * t
      // Exact resolution: consider every legal gap between the level's node
      // disks (band edges included) and take the point nearest the ideal.
      const xs = occupied.get(l)!
      let wx = ideal
      let bestDist = Number.POSITIVE_INFINITY
      for (let g = 0; g <= xs.length; g++) {
        const lo = g === 0 ? 22 : xs[g - 1]! + EDGE_CLEARANCE
        const hi = g === xs.length ? W - 22 : xs[g]! - EDGE_CLEARANCE
        if (lo > hi) continue
        const candidate = Math.min(Math.max(ideal, lo), hi)
        const dist = Math.abs(candidate - ideal)
        if (dist < bestDist) {
          bestDist = dist
          wx = candidate
        }
      }
      const taken = waypointsAtLevel.get(l) ?? []
      const clearOf = (x: number) => taken.every((tx) => Math.abs(x - tx) >= 9)
      for (let step = 1; !clearOf(wx); step++) {
        // Spread colliding waypoints to alternating sides so shared corridors
        // fan out symmetrically instead of stacking into a diagonal comb.
        if (clearOf(wx + step * 9)) wx += step * 9
        else if (clearOf(wx - step * 9)) wx -= step * 9
        else continue
        break
      }
      taken.push(wx)
      waypointsAtLevel.set(l, taken)
      pts.push({ x: Math.min(Math.max(wx, 22), W - 22), y: levelBaseY(l) })
    }
    // Pole ports: every edge leaves through the parent's south pole and
    // arrives at the child's north pole, so a node's edges read as ONE trunk
    // that fans out (and gathers) between the levels — sibling edges can't
    // cross each other at the port. Vertical tangents at every route point
    // keep the direction continuous: straight when aligned, one clean S when
    // displaced, never a kink and never an overshoot.
    const start: Pt = { x: from.x, y: from.y + RADIUS }
    const end: Pt = { x: to.x, y: to.y - RADIUS }
    const all = [start, ...pts, end]
    let d = `M ${r1(all[0]!.x)} ${r1(all[0]!.y)}`
    for (let i = 1; i < all.length; i++) {
      const A = all[i - 1]!
      const B = all[i]!
      const bend = (B.y - A.y) * 0.5
      d += ` C ${r1(A.x)} ${r1(A.y + bend)}, ${r1(B.x)} ${r1(B.y - bend)}, ${r1(B.x)} ${r1(B.y)}`
    }
    edgeRoutes.set(`${p}->${nId}`, d)
  }

  return { positions, depths, maxDepth, edgeRoutes }
}

interface SkillMapProps {
  graph: SkillGraph
  path: Path
  families: Family[]
  familyOf: Map<string, string>
  nodeStates: Map<string, UserNodeState>
  itemStates: Map<string, UserItemState>
  itemsByNode: Map<string, Item[]>
  now: number
  streak: number
}

export function SkillMap({
  graph,
  path,
  families,
  familyOf,
  nodeStates,
  itemStates,
  itemsByNode,
  now,
  streak,
}: SkillMapProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [sharing, setSharing] = useState(false)
  const shareMap = async () => {
    if (!svgRef.current || sharing) return
    setSharing(true)
    try {
      const blob = await renderMapImage(svgRef.current, {
        mastered: masteredCount,
        total: graph.nodes.length,
        streak,
      })
      await shareOrDownload(blob, 'fretpath-map.png')
    } finally {
      setSharing(false)
    }
  }
  const { positions, depths, maxDepth, edgeRoutes } = useMemo(
    () => layoutGraph(graph, familyOf),
    [graph, familyOf],
  )
  const displayId = (id: string) =>
    (PATH_LETTER[familyOf.get(id) ?? ''] ?? 'N') + id.slice(1)

  const familyById = useMemo(
    () => new Map(families.map((f) => [f.id, f])),
    [families],
  )
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(
    null,
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const statusOf = (id: string): NodeStatus =>
    nodeStates.get(id)?.status ?? 'locked'
  const goalIds = useMemo(() => new Set(path.goalNodeIds), [path])

  /** Locked purely because previously-mastered prereqs rotted. */
  const isWeakenedLock = (node: SkillNode): boolean => {
    if (statusOf(node.id) !== 'locked') return false
    const unmet = node.prerequisites.filter(
      (id) => !['mastered', 'maintenance'].includes(statusOf(id)),
    )
    return (
      unmet.length > 0 &&
      unmet.every((id) => isNodeWeakened(graph.nodesById.get(id)!, itemStates, now))
    )
  }

  const needsReview = (node: SkillNode): boolean =>
    isNodeWeakened(node, itemStates, now)

  // Next up: the structurally shallowest available node; fall back to the
  // shallowest in-progress one.
  const nextUpId = useMemo(() => {
    const shallowest = (status: NodeStatus) => {
      const candidates = graph.topoOrder.filter((id) => statusOf(id) === status)
      candidates.sort((a, b) => depths.get(a)! - depths.get(b)!)
      return candidates[0] ?? null
    }
    return shallowest('available') ?? shallowest('in_progress')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, nodeStates, depths])

  const masteredCount = graph.nodes.filter((n) =>
    ['mastered', 'maintenance'].includes(statusOf(n.id)),
  ).length

  const height = levelY(maxDepth) + STAGGER + BOTTOM_PAD
  const hoverNode = hover ? graph.nodesById.get(hover.id) : undefined
  const selected = selectedId ? graph.nodesById.get(selectedId) : undefined

  // Land the user at their rung of the ladder on first render.
  const scrolledRef = useRef(false)
  useEffect(() => {
    if (scrolledRef.current) return
    scrolledRef.current = true
    const targetId = nextUpId ?? graph.topoOrder[0]
    document
      .getElementById(`skillnode-${targetId}`)
      ?.scrollIntoView({ block: 'center' })
  }, [nextUpId, graph])

  // Drawn edges are the transitive reduction: lines the hierarchy already
  // implies (VII→IV when VII's chain passes through VI→…→IV) stay undrawn.
  // The engine still checks every prerequisite; the tooltip lists them all.
  const redundantEdges = useMemo(() => transitivelyRedundantEdges(graph), [graph])

  // Selection: the clicked node's direct prerequisites + dependents.
  const selectedNeighbors = useMemo(() => {
    if (!selectedId) return null
    const ids = new Set<string>([selectedId])
    for (const p of graph.nodesById.get(selectedId)?.prerequisites ?? []) ids.add(p)
    for (const d of graph.dependents.get(selectedId) ?? []) ids.add(d)
    return ids
  }, [graph, selectedId])

  // Edges in three passes: dim lattice, lit filaments, selection highlight.
  const edgeGroups = useMemo(() => {
    const dim: React.ReactNode[] = []
    const lit: React.ReactNode[] = []
    const highlighted: React.ReactNode[] = []
    for (const node of graph.nodes) {
      for (const prereqId of node.prerequisites) {
        const touchesSelection =
          selectedId !== null &&
          (prereqId === selectedId || node.id === selectedId)
        // Implied edges stay undrawn for ambient clarity — but reappear when
        // their node is selected: "show me this node's connections" means
        // ALL of them, including the ones the hierarchy implies.
        if (!touchesSelection && redundantEdges.has(`${prereqId}->${node.id}`)) {
          continue
        }
        const prereqStatus = statusOf(prereqId)
        const isLit = prereqStatus === 'mastered' || prereqStatus === 'maintenance'
        const d = edgeRoutes.get(`${prereqId}->${node.id}`)!
        const key = `${prereqId}-${node.id}`
        if (touchesSelection) {
          highlighted.push(
            <path
              key={key}
              d={d}
              fill="none"
              stroke={isLit ? GOLD_BRIGHT : '#f5f2ea'}
              strokeWidth={2.4}
              opacity={0.95}
              filter="url(#edge-glow)"
            />,
          )
        } else if (isLit) {
          // A route out of a mastered skill has been SAILED: solid gold,
          // no longer a dotted course.
          lit.push(
            <path
              key={key}
              d={d}
              fill="none"
              stroke={GOLD}
              strokeWidth={1.7}
              opacity={selectedId ? 0.18 : 0.6}
            />,
          )
        } else {
          // Unsailed routes are dotted courses on the chart — slightly
          // brighter when they lead into an open (available) skill.
          const intoAvailable = statusOf(node.id) === 'available'
          dim.push(
            <path
              key={key}
              d={d}
              fill="none"
              stroke={BONE}
              strokeWidth={intoAvailable ? 1.5 : 1.1}
              strokeDasharray="1.5 6.5"
              strokeLinecap="round"
              opacity={(intoAvailable ? 0.55 : 0.22) * (selectedId ? 0.3 : 1)}
            />,
          )
        }
      }
    }
    return { dim, lit, highlighted }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, edgeRoutes, nodeStates, redundantEdges, selectedId])

  return (
    <div className="relative">
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between text-sm text-zinc-400">
          <span>
            <span className="font-semibold text-[#edc453]">{masteredCount}</span>
            {' / '}
            {graph.nodes.length} skills mastered
          </span>
          <span className="flex items-center gap-3">
            <span className="hidden gap-3 sm:flex">
              <LegendDot className="bg-amber-400" label="Mastered" />
              <LegendDot className="bg-zinc-400" label="In progress" />
              <LegendDot className="bg-zinc-100" label="Available" />
              <LegendDot className="bg-zinc-700" label="Locked" />
              <LegendDot className="bg-red-600" label="Needs review" />
            </span>
            <button
              className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
              onClick={shareMap}
              disabled={sharing}
            >
              {sharing ? 'Rendering…' : 'Share map'}
            </button>
          </span>
        </div>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${height}`}
          className="w-full rounded-2xl"
          onClick={() => setSelectedId(null)}
        >
          <defs>
            <filter id="edge-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* The night sea. */}
          <rect width={W} height={height} fill={NIGHT} />

          {/* Latitude lines and margin numerals — the chart's graticule. */}
          {Array.from({ length: Math.max(0, maxDepth - 1) }, (_, i) => (
            <line
              key={i}
              x1={16}
              y1={(levelY(i + 1) + levelY(i + 2)) / 2}
              x2={W - 16}
              y2={(levelY(i + 1) + levelY(i + 2)) / 2}
              stroke={BONE}
              strokeWidth={1}
              opacity={0.06}
            />
          ))}
          {Array.from({ length: maxDepth }, (_, i) => i + 1).map((level) => (
            <text
              key={level}
              x={26}
              y={levelY(level) + 8}
              fontSize={24}
              fontStyle="italic"
              fontFamily="Georgia, 'Times New Roman', serif"
              fill="#ffffff"
              opacity={0.5}
            >
              {ROMAN[level]}
            </text>
          ))}

          {/* Compass rose in the south-east water. */}
          <g
            transform={`translate(${W - 86}, ${height - 86})`}
            stroke="#ffffff"
            opacity={0.75}
          >
            <circle r={30} fill="none" strokeWidth={1} />
            <circle r={3} fill={BONE} stroke="none" />
            {[0, 45, 90, 135].map((deg) => (
              <line
                key={deg}
                x1={0}
                y1={deg % 90 === 0 ? -26 : -16}
                x2={0}
                y2={deg % 90 === 0 ? 26 : 16}
                strokeWidth={deg === 0 ? 1.6 : 1}
                transform={`rotate(${deg})`}
              />
            ))}
            <text
              y={-36}
              textAnchor="middle"
              fontSize={13}
              fontFamily={BLACKLETTER}
              fill={BONE}
              stroke="none"
            >
              N
            </text>
          </g>

          {/* The constellation figures — one per land, drawn the way a
              star atlas draws the zodiac: a great ghost figure behind the
              stars that claims the whole territory. Rhythm: MJÖLNIR, haft
              planted, the downstroke that makes the thunder. Theory: a
              VEGVÍSIR wayfinder stave — theory is how you never lose your
              way in the storm. Lead: FENRIR mid-howl, the broken chain at
              his feet — expression is the thing the gods failed to bind. */}
          <g
            stroke={BONE}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
            opacity={0.11}
          >
            {/* Mjölnir — spans the Rhythm land, head high, haft planted.
                The head is the classic pendant crown: wide at the top,
                shoulders sweeping down into the haft. */}
            <g
              transform={`translate(${r1(((BAND_RANGES.rhythm[0] + BAND_RANGES.rhythm[1]) / 2) * W - 120)}, 450) scale(1.2)`}
            >
              <path d="M 22 34 L 178 34 L 164 100 Q 146 134 114 140 L 86 140 Q 54 134 36 100 Z" />
              <path d="M 40 50 L 160 50 L 149 98 Q 135 122 110 127 L 90 127 Q 65 122 51 98 Z" />
              <circle cx={100} cy={88} r={15} />
              <circle cx={100} cy={88} r={5} />
              <path d="M 90 140 L 90 520 M 110 140 L 110 520" />
              <path d="M 88 200 H 112 M 88 265 H 112 M 88 330 H 112 M 88 395 H 112 M 88 460 H 112" />
              <circle cx={100} cy={548} r={26} />
              <circle cx={100} cy={548} r={14} />
            </g>
            {/* Vegvísir — the wayfinder, centered in the shared waters. */}
            <g transform={`translate(${W / 2}, 870)`}>
              <circle r={15} />
              <circle r={5} />
              {[
                'M 0 -24 V -206 M -14 -206 L 0 -192 L 14 -206 M -12 -150 H 12',
                'M 0 -24 V -196 M 0 -205 m -9 0 a 9 9 0 1 0 18 0 a 9 9 0 1 0 -18 0 M -10 -140 H 10',
                'M 0 -24 V -206 M -16 -206 H 16 M -10 -158 H 10 M -10 -136 H 10',
                'M 0 -24 V -186 M 0 -214 L 10 -200 L 0 -186 L -10 -200 Z',
                'M 0 -24 V -206 M -12 -206 H 12 M -12 -188 H 12 M -12 -170 H 12',
                'M 0 -24 V -210 M -12 -196 L 0 -210 L 12 -196 M 0 -120 m -7 0 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0',
                'M 0 -24 V -206 M -14 -202 H 14 M -14 -184 H 14',
                'M 0 -24 V -206 M -12 -212 L 0 -198 L 12 -212 M -10 -148 H 10',
              ].map((d, i) => (
                <path key={i} d={d} transform={`rotate(${i * 45})`} />
              ))}
            </g>
            {/* Fenrir — mid-howl, the broken chain at his feet. One flowing
                silhouette from tail over the rising back to the raised,
                open jaw: the howl is the identifying gesture. */}
            <g
              transform={`translate(${r1(((BAND_RANGES.lead[0] + BAND_RANGES.lead[1]) / 2) * W - 195)}, 460) scale(1.3)`}
            >
              <path d="M 30 470 L 78 430 L 64 380 L 96 330 L 128 250 L 150 190 L 158 150 L 148 112 L 162 84 L 172 100 L 186 78 L 192 102 L 244 62 L 258 76 L 216 104 L 210 112 L 246 128 L 196 140 L 178 190 L 168 250 L 172 330 L 160 400 L 172 470 L 196 472" />
              <path d="M 150 320 L 118 380 L 130 436 L 110 470 L 136 472" />
              <circle cx={196} cy={108} r={2.5} fill={BONE} stroke="none" />
              <circle cx={126} cy={502} r={6} />
              <circle cx={142} cy={508} r={6} />
              <circle cx={176} cy={505} r={6} />
              <circle cx={192} cy={500} r={6} />
            </g>
          </g>

          {edgeGroups.dim}
          {edgeGroups.lit}
          {edgeGroups.highlighted}

          {/* The names of lands, in blackletter — above the edge layer, so
              the level I→II corridor runs BEHIND the titles instead of
              through them. Bone ink only: regions are places, not teams. */}
          <text
            x={W / 2}
            y={52}
            textAnchor="middle"
            fontSize={30}
            letterSpacing="0.14em"
            fontFamily={BLACKLETTER}
            fill={BONE}
            opacity={0.85}
            {...TEXT_HALO}
            strokeWidth={7}
          >
            {familyById.get('foundations')?.name ?? 'Foundations'}
          </text>
          {(
            [
              ['rhythm', (BAND_RANGES.rhythm[0] + BAND_RANGES.rhythm[1]) / 2],
              ['theory', 0.5],
              ['lead', (BAND_RANGES.lead[0] + BAND_RANGES.lead[1]) / 2],
            ] as const
          ).map(([famId, fx]) => (
            <text
              key={famId}
              x={fx * W}
              y={HEADERS_Y}
              textAnchor="middle"
              fontSize={26}
              letterSpacing="0.12em"
              fontFamily={BLACKLETTER}
              fill={BONE}
              opacity={famId === 'theory' ? 0.6 : 0.8}
              {...TEXT_HALO}
              strokeWidth={7}
            >
              {familyById.get(famId)?.name ?? famId}
            </text>
          ))}
          <text
            x={W / 2}
            y={CAPTION_Y}
            textAnchor="middle"
            fontSize={9}
            fontWeight={600}
            letterSpacing="0.32em"
            fill={BONE}
            opacity={0.4}
            {...TEXT_HALO}
            strokeWidth={4}
          >
            SHARED BY BOTH PATHS
          </text>

          {/* Nodes */}
          {graph.nodes.map((node) => {
            const pos = positions.get(node.id)!
            const status = statusOf(node.id)
            const isNext = node.id === nextUpId
            const weakLock = isWeakenedLock(node)
            const dim = status === 'locked' && !weakLock
            const isGoal = goalIds.has(node.id)
            const inSelection = selectedNeighbors?.has(node.id) ?? false
            const isSelected = node.id === selectedId
            const mastery = nodeStates.get(node.id)?.masteryAvg ?? 0
            const style = NODE_STYLE[status]
            // Blood is the price: a debt ring on any skill that owes —
            // decayed mastery, or a lock caused purely by rotten prereqs.
            const owesBlood = weakLock || needsReview(node)
            // Locked stays clearly duller than active, but readable — the
            // whole curriculum should invite browsing. A selection focuses
            // the map onto the clicked node's direct connections.
            const gOpacity = selectedNeighbors
              ? inSelection
                ? 1
                : 0.24
              : dim
                ? 0.85
                : 1
            return (
              <g
                key={node.id}
                id={`skillnode-${node.id}`}
                transform={`translate(${pos.x}, ${pos.y})`}
                opacity={gOpacity}
                className="cursor-pointer"
                onMouseEnter={(e) =>
                  setHover({ id: node.id, x: e.clientX, y: e.clientY })
                }
                onMouseMove={(e) =>
                  setHover({ id: node.id, x: e.clientX, y: e.clientY })
                }
                onMouseLeave={() => setHover(null)}
                onClick={(e) => {
                  // Water clicks (the svg) deselect; keep node clicks ours.
                  e.stopPropagation()
                  setSelectedId((prev) => (prev === node.id ? null : node.id))
                }}
              >
                {status === 'available' && (
                  <circle
                    r={RADIUS}
                    className="pulse-ring"
                    fill="none"
                    stroke={BONE}
                    strokeWidth={1.6}
                  />
                )}
                {isNext && (
                  <circle
                    r={RADIUS + 10}
                    className="spin-slow"
                    fill="none"
                    stroke={BONE}
                    strokeWidth={1.3}
                    strokeDasharray="5 7"
                    opacity={0.8}
                  />
                )}
                {isSelected && (
                  <circle
                    r={RADIUS + 7}
                    fill="none"
                    stroke="#f8fafc"
                    strokeWidth={2}
                    opacity={0.95}
                  />
                )}
                {inSelection && !isSelected && (
                  <circle
                    r={RADIUS + 5}
                    fill="none"
                    stroke={BONE}
                    strokeWidth={1.2}
                    opacity={0.6}
                  />
                )}
                {/* The body: stark geometry — a disc of ink. Black and
                    white are the foundation; silver and gold the prize. */}
                <circle
                  r={RADIUS}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={style.sw}
                  strokeOpacity={style.strokeOpacity}
                  className={status === 'mastered' ? 'glow-amber' : undefined}
                />
                {/* Mastery forges a silver ring around a skill in progress. */}
                {status === 'in_progress' && mastery > 1 && (
                  <circle
                    r={RADIUS + 5}
                    pathLength={100}
                    strokeDasharray={`${r1(mastery)} ${r1(100 - mastery)}`}
                    strokeDashoffset={-25}
                    fill="none"
                    stroke={SILVER}
                    strokeWidth={2}
                    opacity={0.9}
                    strokeLinecap="round"
                  />
                )}
                {/* Blood is the price: the debt ring. */}
                {owesBlood && (
                  <circle
                    r={RADIUS + (status === 'in_progress' ? 9 : 5)}
                    fill="none"
                    stroke={BLOOD}
                    strokeWidth={1.8}
                    strokeDasharray="6 4"
                    opacity={0.9}
                  />
                )}
                {/* Goal skills carry the north star. */}
                {isGoal && (
                  <g
                    transform={`translate(${RADIUS - 2}, ${-RADIUS + 2})`}
                    opacity={status === 'locked' ? 0.55 : 0.95}
                  >
                    <path
                      d="M 0 -8 L 1.6 -1.6 L 8 0 L 1.6 1.6 L 0 8 L -1.6 1.6 L -8 0 L -1.6 -1.6 Z"
                      fill={
                        status === 'mastered' || status === 'maintenance'
                          ? GOLD_BRIGHT
                          : BONE
                      }
                    />
                  </g>
                )}
                <text
                  textAnchor="middle"
                  y={4.5}
                  fontSize={11.5}
                  fontWeight={700}
                  fill={style.text}
                >
                  {displayId(node.id)}
                </text>
                {isNext && (
                  <text
                    textAnchor="middle"
                    y={-RADIUS - 24}
                    fontSize={10}
                    fontWeight={700}
                    letterSpacing="0.2em"
                    fill={BONE}
                    {...TEXT_HALO}
                    strokeWidth={4}
                  >
                    NEXT UP
                  </text>
                )}
                {labelLines(node.name).map((line, i) => (
                  <text
                    key={i}
                    textAnchor="middle"
                    y={RADIUS + 26 + i * 13}
                    fontSize={11}
                    fill={owesBlood ? '#e05a6d' : BONE}
                    opacity={dim ? 0.55 : 0.9}
                    {...TEXT_HALO}
                    strokeWidth={4}
                  >
                    {line}
                  </text>
                ))}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Hover tooltip */}
      {hover && hoverNode && (
        <div
          className="pointer-events-none fixed z-50 w-64 rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-xs shadow-xl"
          style={{ left: Math.min(hover.x + 14, window.innerWidth - 280), top: hover.y + 14 }}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-semibold text-zinc-100">{hoverNode.name}</span>
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${STATUS_BADGE[statusOf(hoverNode.id)]}`}
            >
              {STATUS_LABEL[statusOf(hoverNode.id)]}
            </span>
          </div>
          <div className="text-zinc-400">
            {families.find((f) => f.id === familyOf.get(hoverNode.id))?.name ?? ''}
            {' · mastery '}
            {Math.round(nodeStates.get(hoverNode.id)?.masteryAvg ?? 0)}%
          </div>
          {needsReview(hoverNode) && (
            <div className="mt-1 font-semibold text-amber-400">
              ⚠ Needs review — mastery has decayed below target.
            </div>
          )}
          {isWeakenedLock(hoverNode) && (
            <div className="mt-1 text-amber-400">
              Weakened foundation — review{' '}
              {weakenedPrereqs(graph, hoverNode.id, itemStates, now)
                .map((n) => `«${n.name.split(' (')[0]}»`)
                .join(', ')}{' '}
              to re-unlock.
            </div>
          )}
          {hoverNode.prerequisites.length > 0 && (
            <div className="mt-2">
              <div className="mb-0.5 font-semibold text-zinc-300">Requires</div>
              {hoverNode.prerequisites.map((id) => {
                const met = ['mastered', 'maintenance'].includes(statusOf(id))
                return (
                  <div key={id} className={met ? 'text-emerald-400' : 'text-zinc-500'}>
                    {met ? '✓' : '○'} {graph.nodesById.get(id)!.name}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Selection panel: floats over the chart instead of reflowing it.
          Docks left when the clicked skill lives in the right third, so the
          panel never covers what was just clicked. */}
      {selected && (
        <aside
          className={`absolute top-14 z-40 w-80 max-w-[85vw] rounded-xl border border-zinc-800 bg-[#090a10]/95 p-4 shadow-2xl backdrop-blur ${
            (positions.get(selected.id)?.x ?? 0) > W * 0.6 ? 'left-2' : 'right-2'
          }`}
        >
          <div className="mb-1 flex items-start justify-between gap-2">
            <h3 className="font-semibold text-zinc-100">{selected.name}</h3>
            <button
              className="text-zinc-500 hover:text-zinc-300"
              onClick={() => setSelectedId(null)}
            >
              ✕
            </button>
          </div>
          <span
            className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_BADGE[statusOf(selected.id)]}`}
          >
            {STATUS_LABEL[statusOf(selected.id)]}
          </span>
          {needsReview(selected) && (
            <span className="ml-1.5 inline-block rounded bg-amber-900/60 px-2 py-0.5 text-xs text-amber-300">
              Needs review
            </span>
          )}
          {isWeakenedLock(selected) && (
            <p className="mt-2 text-xs text-amber-400">
              Weakened foundation — review{' '}
              {weakenedPrereqs(graph, selected.id, itemStates, now)
                .map((n) => `«${n.name.split(' (')[0]}»`)
                .join(', ')}{' '}
              to re-unlock this skill.
            </p>
          )}
          <dl className="mt-3 space-y-1 text-sm text-zinc-400">
            <div>
              Level {ROMAN[depths.get(selected.id) ?? 0]} ·{' '}
              {families.find((f) => f.id === familyOf.get(selected.id))?.name ?? ''}
            </div>
            <div>
              Mastery: {Math.round(nodeStates.get(selected.id)?.masteryAvg ?? 0)}%
            </div>
            <div>
              Drills: {itemsByNode.get(selected.id)?.length ?? 0}
            </div>
          </dl>
          {(() => {
            const unlocks = unlocksAfter(graph, selected.id, itemStates, now)
            return unlocks.length > 0 ? (
              <div className="mt-3 text-sm">
                <div className="mb-1 font-semibold text-zinc-300">
                  Mastering this unlocks
                </div>
                {unlocks.map((n) => (
                  <div key={n.id} className="text-amber-400/90">
                    ★ {n.name}
                  </div>
                ))}
              </div>
            ) : null
          })()}
        </aside>
      )}
    </div>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  )
}
