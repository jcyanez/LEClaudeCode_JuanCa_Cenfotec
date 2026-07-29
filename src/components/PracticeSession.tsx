/**
 * The practice flow: one item at a time. A node's lesson is shown once before
 * its first drill in the session. Then each item is worked by kind:
 *
 * - gate  → read the prompt, reveal the answer, tap Got it / Not yet.
 * - drill → play it to the metronome and climb the tempo ladder; the fastest
 *           clean tempo you lock in is the grade (mastery = best ÷ target).
 *
 * Each attempt is persisted immediately (both engines run on every attempt), so
 * quitting mid-session loses nothing.
 */

import { useState } from 'react'
import type { AttemptResult, Item, ItemResult, ItemType } from '../engine/types'
import type { Lesson as LessonContent } from '../data/loader'
import { Fretboard, markersFromMetadata, posKey } from './Fretboard'
import { TempoLadder } from './TempoLadder'
import { TuningPanel } from './TuningPanel'
import { Lesson } from './Lesson'

const TYPE_LABEL: Record<ItemType, string> = {
  note_id: 'Note ID',
  chord_change: 'Chord change',
  scale_run: 'Scale run',
  technique_rep: 'Technique rep',
  riff: 'Riff',
}

const LESSONS_SEEN_KEY = 'fretpath:lessons-seen'

function loadLessonsSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(LESSONS_SEEN_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function persistLessonsSeen(seen: Set<string>): void {
  try {
    localStorage.setItem(LESSONS_SEEN_KEY, JSON.stringify([...seen]))
  } catch {
    /* storage full / disabled — showing a lesson twice is harmless */
  }
}

interface PracticeSessionProps {
  items: Item[]
  nodeNameOf: (nodeId: string) => string
  lessonOf: (nodeId: string) => LessonContent | null
  bestBpmOf: (itemId: string) => number | null
  /** Persist one attempt; resolves when both engines have run. */
  onAttempt: (item: Item, result: AttemptResult) => Promise<void>
  onFinish: (results: ItemResult[]) => void
  onQuit: (results: ItemResult[]) => void
}

export function PracticeSession({
  items,
  nodeNameOf,
  lessonOf,
  bestBpmOf,
  onAttempt,
  onFinish,
  onQuit,
}: PracticeSessionProps) {
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [userMarks, setUserMarks] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<ItemResult[]>([])
  const [saving, setSaving] = useState(false)
  const [lessonsSeen, setLessonsSeen] = useState<Set<string>>(loadLessonsSeen)

  const item = items[index]
  if (!item) return null

  const isGate = item.metadata.gate === true
  const targetBpm =
    typeof item.metadata.targetBpm === 'number' ? item.metadata.targetBpm : null
  const subdivision =
    typeof item.metadata.subdivision === 'string'
      ? item.metadata.subdivision
      : undefined
  const answerMarkers = markersFromMetadata(item.metadata)
  const selfAssess =
    typeof item.metadata.selfAssess === 'string' ? item.metadata.selfAssess : null

  const lesson = lessonOf(item.nodeId)
  const showLesson = lesson !== null && !lessonsSeen.has(item.nodeId)

  const toggleMark = (string: number, fret: number) => {
    setUserMarks((prev) => {
      const next = new Set(prev)
      const key = posKey(string, fret)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const markLessonSeen = (nodeId: string) => {
    setLessonsSeen((prev) => {
      const next = new Set(prev).add(nodeId)
      persistLessonsSeen(next)
      return next
    })
  }

  const advance = (nextResults: ItemResult[]) => {
    if (index + 1 >= items.length) {
      onFinish(nextResults)
    } else {
      setIndex(index + 1)
      setRevealed(false)
      setUserMarks(new Set())
    }
  }

  const commit = async (result: AttemptResult) => {
    if (saving) return
    setSaving(true)
    try {
      await onAttempt(item, result)
    } finally {
      setSaving(false)
    }
    const nextResults: ItemResult[] = [
      ...results,
      { itemId: item.id, timestamp: Date.now(), ...result },
    ]
    setResults(nextResults)
    advance(nextResults)
  }

  // Progress header (shared by lesson + drill views).
  const header = (
    <>
      <div className="mb-4 flex items-center justify-between text-sm text-zinc-400">
        <span>
          Item <span className="font-semibold text-zinc-200">{index + 1}</span> of{' '}
          {items.length}
        </span>
        <button
          className="text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
          onClick={() => onQuit(results)}
        >
          End session
        </button>
      </div>
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-[#e9e4d6] transition-all"
          style={{ width: `${(index / items.length) * 100}%` }}
        />
      </div>
    </>
  )

  if (showLesson && lesson) {
    return (
      <div className="mx-auto max-w-4xl">
        {header}
        <Lesson
          nodeName={nodeNameOf(item.nodeId)}
          lesson={lesson}
          ctaLabel="Start the drills"
          onContinue={() => markLessonSeen(item.nodeId)}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      {header}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        {/* Item header */}
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 font-semibold text-[#e9e4d6]">
            {nodeNameOf(item.nodeId)}
          </span>
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-400">
            {TYPE_LABEL[item.type]}
          </span>
          <span
            className={`rounded px-2 py-0.5 font-semibold ${
              isGate
                ? 'bg-zinc-800 text-zinc-400'
                : 'bg-amber-950/50 text-amber-300'
            }`}
          >
            {isGate ? 'understand it' : 'metronome drill'}
          </span>
        </div>

        <p className="mb-4 text-lg leading-relaxed text-zinc-100">{item.prompt}</p>

        {typeof item.metadata.tuning === 'string' && (
          <div className="mb-4">
            <TuningPanel tuning={item.metadata.tuning} />
          </div>
        )}

        {isGate ? (
          <GateFlow
            key={item.id}
            answer={item.answer}
            selfAssess={selfAssess}
            answerMarkers={answerMarkers}
            userMarks={userMarks}
            onToggleMark={toggleMark}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
            saving={saving}
            onDecide={(got) => commit({ kind: 'gate', got })}
          />
        ) : (
          <DrillFlow
            key={item.id}
            targetBpm={targetBpm ?? 60}
            subdivision={subdivision}
            bestBpm={bestBpmOf(item.id)}
            selfAssess={selfAssess}
            answerMarkers={answerMarkers}
            userMarks={userMarks}
            onToggleMark={toggleMark}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
            saving={saving}
            onLock={(bpm) =>
              commit({ kind: 'drill', bpm, targetBpm: targetBpm ?? 60 })
            }
          />
        )}
      </div>
    </div>
  )
}

interface FretboardBlockProps {
  answerMarkers: ReturnType<typeof markersFromMetadata>
  userMarks: Set<string>
  onToggleMark: (string: number, fret: number) => void
  revealed: boolean
  onReveal: () => void
  revealLabel: string
  hint: string
}

function FretboardBlock({
  answerMarkers,
  userMarks,
  onToggleMark,
  revealed,
  onReveal,
  revealLabel,
  hint,
}: FretboardBlockProps) {
  const hasPositions = answerMarkers.length > 0
  return (
    <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
      <Fretboard
        markers={revealed ? answerMarkers : []}
        userMarks={userMarks}
        onToggle={onToggleMark}
      />
      <div className="mt-1 flex items-center justify-between">
        <p className="text-xs text-zinc-600">{hint}</p>
        {hasPositions && !revealed && (
          <button
            className="text-xs text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
            onClick={onReveal}
          >
            {revealLabel}
          </button>
        )}
      </div>
    </div>
  )
}

interface GateFlowProps {
  answer: string
  selfAssess: string | null
  answerMarkers: ReturnType<typeof markersFromMetadata>
  userMarks: Set<string>
  onToggleMark: (string: number, fret: number) => void
  revealed: boolean
  onReveal: () => void
  saving: boolean
  onDecide: (got: boolean) => void
}

function GateFlow({
  answer,
  selfAssess,
  answerMarkers,
  userMarks,
  onToggleMark,
  revealed,
  onReveal,
  saving,
  onDecide,
}: GateFlowProps) {
  return (
    <div>
      <FretboardBlock
        answerMarkers={answerMarkers}
        userMarks={userMarks}
        onToggleMark={onToggleMark}
        revealed={revealed}
        onReveal={onReveal}
        revealLabel="Show positions"
        hint="Work it out — tap the fretboard, or just play it on your guitar."
      />
      {!revealed ? (
        <button
          className="w-full rounded-lg bg-zinc-800 py-3 font-semibold text-zinc-100 transition-colors hover:bg-zinc-700"
          onClick={onReveal}
        >
          Show answer
        </button>
      ) : (
        <div>
          <div className="mb-4 rounded-lg border border-amber-900/50 bg-amber-950/30 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-500">
              Answer
            </div>
            <p className="text-amber-100">{answer}</p>
            {selfAssess && (
              <p className="mt-2 text-xs text-amber-300/70">{selfAssess}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={saving}
              className="rounded-lg bg-zinc-800 py-3 font-semibold text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
              onClick={() => onDecide(false)}
            >
              Not yet
            </button>
            <button
              disabled={saving}
              className="rounded-lg bg-[#e9e4d6] py-3 font-semibold text-zinc-950 transition-colors hover:bg-white disabled:opacity-50"
              onClick={() => onDecide(true)}
            >
              Got it ✓
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-zinc-600">
            "Not yet" just brings it back next time — no penalty.
          </p>
        </div>
      )}
    </div>
  )
}

interface DrillFlowProps {
  targetBpm: number
  subdivision?: string
  bestBpm: number | null
  selfAssess: string | null
  answerMarkers: ReturnType<typeof markersFromMetadata>
  userMarks: Set<string>
  onToggleMark: (string: number, fret: number) => void
  revealed: boolean
  onReveal: () => void
  saving: boolean
  onLock: (bpm: number) => void
}

function DrillFlow({
  targetBpm,
  subdivision,
  bestBpm,
  selfAssess,
  answerMarkers,
  userMarks,
  onToggleMark,
  revealed,
  onReveal,
  saving,
  onLock,
}: DrillFlowProps) {
  return (
    <div>
      <FretboardBlock
        answerMarkers={answerMarkers}
        userMarks={userMarks}
        onToggleMark={onToggleMark}
        revealed={revealed}
        onReveal={onReveal}
        revealLabel="Show positions"
        hint="Play it on your guitar. Tap the fretboard if you want to check the shape."
      />
      {selfAssess && (
        <p className="mb-3 text-sm text-amber-300/80">
          <span className="font-semibold text-amber-400">Clean means:</span>{' '}
          {selfAssess.replace(/^\s*5\s*=\s*/, '')}
        </p>
      )}
      <TempoLadder
        targetBpm={targetBpm}
        subdivision={subdivision}
        bestBpm={bestBpm}
        saving={saving}
        onLock={onLock}
      />
    </div>
  )
}
