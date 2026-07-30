/**
 * Regenerates the landing page's hero visual: the real skill map, rendered
 * server-side with a believable mid-journey state (Tier 0 + pentatonic
 * mastered, palm muting / alt picking in progress, unlocks pulsing above).
 *
 * Run after map or content changes:  npx vite-node scripts/generate-landing-map.tsx
 * Output: src/landing-map.svg, injected into the landing by src/landing.ts.
 */

import { writeFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadMetalContent } from '../src/data/loader'
import { computeAllNodeStates } from '../src/engine/graph'
import { SkillMap } from '../src/components/SkillMap'
import type { Item, UserItemState } from '../src/engine/types'

const DAY = 86_400_000
const now = Date.now()
const { graph, path, items, families, familyOf } = loadMetalContent()

const MASTERED_NODES = new Set(['N01', 'N02', 'N03', 'N04', 'N05', 'N10'])
const IN_PROGRESS: Record<string, number> = { 'N06-1': 45, 'N06-2': 30, 'N07-1': 55 }

const itemStates = new Map<string, UserItemState>()
for (const item of items) {
  if (MASTERED_NODES.has(item.nodeId)) {
    itemStates.set(item.id, {
      itemId: item.id,
      easiness: 2.6,
      interval: 12,
      repetitions: 4,
      mastery: 92,
      dueDate: now + 6 * DAY,
      lastReviewed: now - DAY,
    })
  } else if (item.id in IN_PROGRESS) {
    itemStates.set(item.id, {
      itemId: item.id,
      easiness: 2.5,
      interval: 6,
      repetitions: 2,
      mastery: IN_PROGRESS[item.id]!,
      dueDate: now + 3 * DAY,
      lastReviewed: now - DAY,
    })
  }
}

const itemsByNode = new Map<string, Item[]>()
for (const item of items) {
  const list = itemsByNode.get(item.nodeId) ?? []
  list.push(item)
  itemsByNode.set(item.nodeId, list)
}

const markup = renderToStaticMarkup(
  createElement(SkillMap, {
    graph,
    path,
    families,
    familyOf,
    nodeStates: computeAllNodeStates(graph, itemStates, now),
    itemStates,
    itemsByNode,
    now,
  }),
)

const start = markup.indexOf('<svg')
const end = markup.indexOf('</svg>') + '</svg>'.length
if (start < 0 || end < 6) throw new Error('no <svg> found in SkillMap markup')
const svg = markup
  .slice(start, end)
  .replace(
    /class="w-full rounded-2xl"/,
    'class="w-full h-auto" aria-hidden="true"',
  )

writeFileSync(new URL('../src/landing-map.svg', import.meta.url), svg + '\n')
console.log(`wrote src/landing-map.svg (${svg.length} chars)`)
