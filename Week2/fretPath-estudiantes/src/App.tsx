import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { applyAttempt, recordSession, resetProgress } from './db/repo'
import { loadMetalContent } from './data/loader'
import { computeAllNodeStates } from './engine/graph'
import {
  assembleSession,
  nextDueAt,
  SESSION_BUDGETS,
  type SessionLength,
} from './engine/session'
import { isDue, isNew } from './engine/srs'
import { computeStreak } from './engine/streak'
import type { AttemptResult, Item, ItemResult, NodeStatus } from './engine/types'
import { SkillMap } from './components/SkillMap'
import { PracticeSession } from './components/PracticeSession'
import { TuningPanel } from './components/TuningPanel'
import { GuideSheet } from './components/GuideSheet'
import { ProgressPanel } from './components/ProgressPanel'

type View =
  | { kind: 'map' }
  | { kind: 'practice'; items: Item[] }
  | { kind: 'summary'; results: ItemResult[]; unlocked: string[]; mastered: string[] }

const UNLOCKED_STATUSES: NodeStatus[] = ['available', 'in_progress']
const MASTERED_STATUSES: NodeStatus[] = ['mastered', 'maintenance']

const LENGTH_STORAGE_KEY = 'fretpath:session-length'

const LENGTH_OPTIONS: { length: SessionLength; label: string; blurb: string }[] = [
  { length: 'quick', label: 'Quick', blurb: 'warm-up on a busy day' },
  { length: 'standard', label: 'Standard', blurb: 'the daily session' },
  { length: 'long', label: 'Long', blurb: 'deep practice block' },
]

function preferredLength(): SessionLength {
  const raw = localStorage.getItem(LENGTH_STORAGE_KEY)
  return raw === 'quick' || raw === 'standard' || raw === 'long'
    ? raw
    : 'standard'
}

function formatEta(fromNow: number): string {
  const hours = fromNow / 3_600_000
  if (hours < 1) return '<1h'
  if (hours < 48) return `~${Math.ceil(hours)}h`
  return `~${Math.ceil(hours / 24)}d`
}

export default function App() {
  // Seed content is static and validated once (throws loudly if the DAG or
  // item references are broken — we'd rather fail at startup than mid-drill).
  const content = useMemo(loadMetalContent, [])
  const { graph, path, items, families, familyOf, lessons } = content

  const itemsByNode = useMemo(() => {
    const map = new Map<string, Item[]>()
    for (const item of items) {
      const list = map.get(item.nodeId) ?? []
      list.push(item)
      map.set(item.nodeId, list)
    }
    return map
  }, [items])

  const itemRows = useLiveQuery(() => db.itemStates.toArray(), [])
  const itemStates = useMemo(
    () => new Map((itemRows ?? []).map((row) => [row.itemId, row])),
    [itemRows],
  )
  const sessionRows = useLiveQuery(() => db.sessions.toArray(), [])

  const [view, setView] = useState<View>({ kind: 'map' })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [tunerOpen, setTunerOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  // The clock all status/due computations read. Refreshed every minute and
  // on returning to the foreground — statuses are functions of "now", and a
  // PWA left open overnight must not show yesterday's due counts (audit
  // 2026-07-18, F1).
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    const interval = setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  const nodeStates = useMemo(
    () => computeAllNodeStates(graph, itemStates, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph, itemStates],
  )

  // Statuses snapshotted when a session starts, to diff for the summary.
  const preSessionStatuses = useRef<Map<string, NodeStatus>>(new Map())

  // Daily-loop signals: what can be practiced right now, and what's next.
  const practicableIds = useMemo(
    () =>
      new Set(
        [...nodeStates]
          .filter(([, s]) => UNLOCKED_STATUSES.includes(s.status))
          .map(([id]) => id),
      ),
    [nodeStates],
  )
  const dueCount = items.filter((item) => {
    if (!practicableIds.has(item.nodeId)) return false
    const state = itemStates.get(item.id)
    return state !== undefined && isDue(state, now)
  }).length
  const freshCount = items.filter(
    (item) => practicableIds.has(item.nodeId) && isNew(itemStates.get(item.id)),
  ).length
  const nextDue = nextDueAt(items, itemStates, practicableIds, now)
  const streak = computeStreak((sessionRows ?? []).map((s) => s.date), now)
  const caughtUp = dueCount === 0 && freshCount === 0

  // Due today = anything scheduled up to local midnight (includes overdue);
  // due tomorrow = the following 24h window.
  const endOfToday = useMemo(() => {
    const d = new Date(now)
    d.setHours(23, 59, 59, 999)
    return d.getTime()
  }, [now])
  const dueWithin = (from: number, to: number) =>
    items.filter((item) => {
      if (!practicableIds.has(item.nodeId)) return false
      const due = itemStates.get(item.id)?.dueDate
      return due != null && due > from && due <= to
    }).length
  const dueToday = dueWithin(0, endOfToday)
  const dueTomorrow = dueWithin(endOfToday, endOfToday + 24 * 60 * 60 * 1000)

  const startPractice = (length: SessionLength) => {
    localStorage.setItem(LENGTH_STORAGE_KEY, length)
    setPickerOpen(false)
    const plan = assembleSession(
      graph, path, items, itemStates, Date.now(), SESSION_BUDGETS[length],
      { excludeDue: caughtUp },
    )
    if (plan.items.length === 0) return
    preSessionStatuses.current = new Map(
      [...nodeStates].map(([id, s]) => [id, s.status]),
    )
    setView({ kind: 'practice', items: plan.items })
  }

  const finishSession = async (results: ItemResult[]) => {
    if (results.length > 0) await recordSession(results, Date.now())
    const after = computeAllNodeStates(
      graph,
      new Map((await db.itemStates.toArray()).map((r) => [r.itemId, r])),
      Date.now(),
    )
    const before = preSessionStatuses.current
    const unlocked: string[] = []
    const mastered: string[] = []
    for (const [id, state] of after) {
      const prev = before.get(id) ?? 'locked'
      if (prev === 'locked' && UNLOCKED_STATUSES.includes(state.status)) {
        unlocked.push(graph.nodesById.get(id)!.name)
      }
      if (!MASTERED_STATUSES.includes(prev) && MASTERED_STATUSES.includes(state.status)) {
        mastered.push(graph.nodesById.get(id)!.name)
      }
    }
    setView({ kind: 'summary', results, unlocked, mastered })
  }

  const handleAttempt = async (item: Item, result: AttemptResult) => {
    await applyAttempt(graph, item, result, Date.now())
  }

  const loading = itemRows === undefined

  return (
    <div className="min-h-screen bg-[#05060a] text-zinc-100">
      <header className="border-b border-zinc-900 bg-[#05060a]/90 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-3">
          <button
            className="flex items-baseline gap-2.5"
            onClick={() => setView({ kind: 'map' })}
          >
            <span
              className="text-2xl text-[#e9e4d6]"
              style={{ fontFamily: "'Pirata One', Georgia, serif" }}
            >
              FretPath
            </span>
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Metal path
            </span>
          </button>
          <div className="flex items-center gap-3">
            <button
              aria-label="How to read the drills"
              title="How to read the drills"
              className="h-8 w-8 rounded-full border border-zinc-700 text-sm font-bold text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              onClick={() => setGuideOpen(true)}
            >
              ?
            </button>
          {view.kind === 'map' && !loading && (
            <div className="flex items-center gap-3">
              {streak >= 2 && (
                <span
                  className="text-sm font-semibold text-amber-400"
                  title={`${streak}-day practice streak`}
                >
                  🔥 {streak}
                </span>
              )}
              {caughtUp ? (
                <button
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-800"
                  onClick={() => setPickerOpen(true)}
                >
                  All caught up
                  {nextDue !== null && (
                    <span className="text-zinc-500"> · next {formatEta(nextDue - now)}</span>
                  )}
                  <span className="ml-2 text-zinc-500">· Bonus practice</span>
                </button>
              ) : (
                <button
                  className={
                    dueCount > 0
                      ? 'rounded-lg bg-[#c8102e] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#e01236]'
                      : 'rounded-lg bg-[#e9e4d6] px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-white'
                  }
                  onClick={() => setPickerOpen(true)}
                >
                  {dueCount > 0
                    ? `Practice · ${dueCount} due`
                    : 'Learn new material'}
                </button>
              )}
            </div>
          )}
          </div>
        </div>
      </header>

      <main className="px-6 py-6">
        {loading ? (
          <p className="py-20 text-center text-zinc-500">Loading…</p>
        ) : view.kind === 'map' ? (
          <>
            <ProgressPanel
              families={families}
              familyOf={familyOf}
              nodeStates={nodeStates}
              sessions={sessionRows ?? []}
              streak={streak}
              dueToday={dueToday}
              dueTomorrow={dueTomorrow}
              now={now}
            />
            <SkillMap
              graph={graph}
              path={path}
              families={families}
              familyOf={familyOf}
              nodeStates={nodeStates}
              itemStates={itemStates}
              itemsByNode={itemsByNode}
              now={now}
              streak={streak}
            />
          </>
        ) : view.kind === 'practice' ? (
          <PracticeSession
            items={view.items}
            nodeNameOf={(nodeId) => graph.nodesById.get(nodeId)?.name ?? nodeId}
            lessonOf={(nodeId) => lessons.get(nodeId) ?? null}
            bestBpmOf={(itemId) => itemStates.get(itemId)?.bestBpm ?? null}
            onAttempt={handleAttempt}
            onFinish={finishSession}
            onQuit={finishSession}
          />
        ) : (
          <SessionSummary
            results={view.results}
            unlocked={view.unlocked}
            mastered={view.mastered}
            onDone={() => setView({ kind: 'map' })}
          />
        )}
      </main>

      {pickerOpen && view.kind === 'map' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-bold text-zinc-100">
              How long do you have?
            </h2>
            <p className="mb-4 text-xs text-zinc-500">
              The session fills with the most valuable work that fits.
            </p>
            <div className="space-y-2">
              {LENGTH_OPTIONS.map(({ length, label, blurb }) => (
                <button
                  key={length}
                  className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                    length === preferredLength()
                      ? 'border-red-600 bg-red-950/40 hover:bg-red-950/70'
                      : 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800'
                  }`}
                  onClick={() => startPractice(length)}
                >
                  <span>
                    <span className="font-semibold text-zinc-100">{label}</span>
                    <span className="ml-2 text-xs text-zinc-500">{blurb}</span>
                  </span>
                  <span className="text-sm font-semibold text-zinc-400">
                    ~{SESSION_BUDGETS[length]} min
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <footer className="px-6 pb-6">
        {tunerOpen && (
          <div className="mb-3">
            <TuningPanel />
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex gap-4">
            <button
              className="text-xs text-zinc-300 hover:text-white"
              onClick={() => setTunerOpen((open) => !open)}
            >
              {tunerOpen ? 'Hide tuning reference' : 'Tuning reference'}
            </button>
            <button
              className="text-xs text-zinc-300 hover:text-white"
              onClick={() => setGuideOpen(true)}
            >
              How to read the drills
            </button>
          </div>
          <button
            className="text-xs text-zinc-500 hover:text-zinc-300"
            onClick={async () => {
              if (window.confirm('Erase all practice progress?')) {
                await resetProgress()
                setView({ kind: 'map' })
              }
            }}
          >
            Reset progress
          </button>
        </div>
      </footer>

      {guideOpen && <GuideSheet onClose={() => setGuideOpen(false)} />}
    </div>
  )
}

function SessionSummary({
  results,
  unlocked,
  mastered,
  onDone,
}: {
  results: ItemResult[]
  unlocked: string[]
  mastered: string[]
  onDone: () => void
}) {
  // "Nailed" = a gate you got, or a drill you locked in at/above target tempo.
  const nailed = results.filter((r) =>
    r.kind === 'gate' ? r.got : r.bpm >= r.targetBpm,
  ).length
  const topTempo = results.reduce(
    (max, r) => (r.kind === 'drill' ? Math.max(max, r.bpm) : max),
    0,
  )
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-center">
      <h2
        className="mb-1 text-3xl text-[#e9e4d6]"
        style={{ fontFamily: "'Pirata One', Georgia, serif" }}
      >
        Session complete
      </h2>
      <p className="mb-5 text-sm text-zinc-400">
        {results.length} items · {nailed} nailed
        {topTempo > 0 && <> · top tempo {topTempo} bpm</>}
      </p>
      {mastered.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-900/50 bg-amber-950/30 p-3 text-sm">
          <div className="font-semibold text-amber-300">Skills won</div>
          {mastered.map((name) => (
            <div key={name} className="text-amber-100">★ {name}</div>
          ))}
        </div>
      )}
      {unlocked.length > 0 && (
        <div className="mb-3 rounded-lg border border-zinc-700 bg-zinc-800/40 p-3 text-sm">
          <div className="font-semibold text-[#e9e4d6]">New skills open</div>
          {unlocked.map((name) => (
            <div key={name} className="text-zinc-200">⚓ {name}</div>
          ))}
        </div>
      )}
      <button
        className="mt-2 rounded-lg bg-[#e9e4d6] px-5 py-2.5 font-semibold text-zinc-950 transition-colors hover:bg-white"
        onClick={onDone}
      >
        Back to the map
      </button>
    </div>
  )
}
