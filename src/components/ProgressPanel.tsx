/**
 * Motivation strip above the map: streak, this week's work, what's due, and
 * per-family mastery bars ("what kind of player am I becoming?"). Everything
 * is derived from existing state — no new persistence, light analytics only.
 */

import { useMemo } from 'react'
import type { SessionRecord, UserNodeState } from '../engine/types'
import type { Family } from '../data/loader'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

interface ProgressPanelProps {
  families: Family[]
  familyOf: Map<string, string>
  nodeStates: Map<string, UserNodeState>
  sessions: SessionRecord[]
  streak: number
  dueToday: number
  dueTomorrow: number
  now: number
}

export function ProgressPanel({
  families,
  familyOf,
  nodeStates,
  sessions,
  streak,
  dueToday,
  dueTomorrow,
  now,
}: ProgressPanelProps) {
  const week = sessions.filter((s) => s.date >= now - WEEK_MS)
  const itemsThisWeek = week.reduce((sum, s) => sum + s.itemResults.length, 0)

  const familyMastery = useMemo(() => {
    const sums = new Map<string, { total: number; count: number }>()
    for (const [nodeId, familyId] of familyOf) {
      const entry = sums.get(familyId) ?? { total: 0, count: 0 }
      entry.total += nodeStates.get(nodeId)?.masteryAvg ?? 0
      entry.count += 1
      sums.set(familyId, entry)
    }
    return families.map((family) => {
      const entry = sums.get(family.id)
      return {
        family,
        pct: entry && entry.count > 0 ? entry.total / entry.count : 0,
      }
    })
  }, [families, familyOf, nodeStates])

  return (
    <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <Stat
          label="streak"
          value={streak > 0 ? `🔥 ${streak}d` : '—'}
          strong={streak >= 2}
        />
        <Stat label="this week" value={`${week.length} sessions · ${itemsThisWeek} drills`} />
        {/* Due reviews are a debt — blood, per the map's color law. */}
        <Stat
          label="due today"
          value={String(dueToday)}
          strong={dueToday > 0}
          tone="blood"
        />
        <Stat label="due tomorrow" value={String(dueTomorrow)} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-4">
        {familyMastery.map(({ family, pct }) => (
          <div key={family.id} className="flex items-center gap-2 text-xs">
            <span
              className="w-28 shrink-0 truncate text-zinc-500"
              title={family.name}
            >
              {family.name}
            </span>
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-800">
              {/* Silver while forging, gold when the land is won. */}
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round(pct)}%`,
                  background:
                    pct >= 99.5
                      ? 'linear-gradient(to right, #d4a72c88, #edc453)'
                      : 'linear-gradient(to right, #c7ccd655, #c7ccd6)',
                }}
              />
            </div>
            <span className="w-8 text-right font-mono text-zinc-400">
              {Math.round(pct)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  strong = false,
  tone = 'gold',
}: {
  label: string
  value: string
  strong?: boolean
  tone?: 'gold' | 'blood'
}) {
  const strongClass =
    tone === 'blood'
      ? 'font-semibold text-[#e0455c]'
      : 'font-semibold text-[#edc453]'
  return (
    <span className="flex items-baseline gap-1.5">
      <span className={strong ? strongClass : 'text-zinc-200'}>{value}</span>
      <span className="text-xs uppercase tracking-wide text-zinc-600">{label}</span>
    </span>
  )
}
