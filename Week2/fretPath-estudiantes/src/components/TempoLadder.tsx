/**
 * The tempo ladder — how a metronome drill is graded. The click runs while you
 * play; you push the tempo up as long as it stays clean, then lock in your best
 * clean tempo. That locked bpm is the attempt result (mastery = best ÷ target).
 *
 * Mount with key={item.id} so switching items disposes the audio engine (the
 * same discipline as MetronomePanel — the click can never leak to the next item).
 */

import { useEffect, useRef, useState } from 'react'
import { clampBpm, Metronome, ticksPerBeatFor } from '../audio/metronome'

const SUB_LABEL: Record<number, string> = { 2: '8ths', 3: 'triplets', 4: '16ths' }

interface TempoLadderProps {
  targetBpm: number
  subdivision?: string
  /** The user's prior best clean tempo on this drill, if any. */
  bestBpm: number | null
  saving: boolean
  onLock: (bpm: number) => void
}

/** Where the ladder starts: resume at your best, else a gentle floor. */
function startingBpm(targetBpm: number, bestBpm: number | null): number {
  if (bestBpm && bestBpm > 0) return clampBpm(bestBpm)
  return clampBpm(Math.round((targetBpm * 0.6) / 5) * 5)
}

export function TempoLadder({
  targetBpm,
  subdivision,
  bestBpm,
  saving,
  onLock,
}: TempoLadderProps) {
  const maxTicks = ticksPerBeatFor(subdivision)
  const [bpm, setBpm] = useState(() => startingBpm(targetBpm, bestBpm))
  const [running, setRunning] = useState(false)
  const [subOn, setSubOn] = useState(maxTicks > 1)
  const engineRef = useRef<Metronome | null>(null)

  useEffect(() => {
    return () => engineRef.current?.dispose()
  }, [])

  const toggle = () => {
    if (running) {
      engineRef.current?.stop()
      setRunning(false)
      return
    }
    engineRef.current ??= new Metronome(bpm, subOn ? maxTicks : 1)
    engineRef.current.setBpm(bpm)
    engineRef.current.setTicksPerBeat(subOn ? maxTicks : 1)
    engineRef.current.start()
    setRunning(true)
  }

  const nudge = (delta: number) => {
    setBpm((prev) => {
      const next = clampBpm(prev + delta)
      engineRef.current?.setBpm(next)
      return next
    })
  }

  const toggleSub = () => {
    const next = !subOn
    setSubOn(next)
    engineRef.current?.setTicksPerBeat(next ? maxTicks : 1)
  }

  const lock = () => {
    engineRef.current?.stop()
    setRunning(false)
    onLock(bpm)
  }

  const reachedTarget = bpm >= targetBpm
  const pct = Math.min(100, Math.round((bpm / targetBpm) * 100))

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Tempo ladder
        </span>
        <span className="text-xs text-zinc-500">
          target <span className="font-mono text-zinc-300">{targetBpm}</span>
          {bestBpm ? (
            <>
              {' · '}your best{' '}
              <span className="font-mono text-amber-400">{bestBpm}</span>
            </>
          ) : null}
        </span>
      </div>

      {/* Current tempo + progress toward target */}
      <div className="mb-3">
        <div className="mb-1 flex items-end justify-center gap-1">
          <span className="font-mono text-4xl font-bold text-zinc-100">{bpm}</span>
          <span className="mb-1 text-sm text-zinc-500">bpm</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all ${
              reachedTarget ? 'bg-amber-400' : 'bg-zinc-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Transport + fine adjust */}
      <div className="mb-3 flex items-center justify-center gap-3">
        <button
          className={`rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
            running
              ? 'bg-[#c8102e] text-white hover:bg-[#e01236]'
              : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
          }`}
          onClick={toggle}
          aria-label={running ? 'Stop metronome' : 'Start metronome'}
        >
          {running ? '■ Stop' : '▶ Start'}
        </button>
        <button
          className="rounded-md bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700"
          onClick={() => nudge(-5)}
          aria-label="Slower"
        >
          −5
        </button>
        <button
          className="rounded-md bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700"
          onClick={() => nudge(5)}
          aria-label="Faster"
        >
          +5
        </button>
        {maxTicks > 1 && (
          <button
            className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              subOn
                ? 'bg-amber-900/60 text-amber-300 hover:bg-amber-900'
                : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
            }`}
            onClick={toggleSub}
          >
            {SUB_LABEL[maxTicks]} {subOn ? 'on' : 'off'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          disabled={saving}
          className="rounded-lg bg-zinc-800 py-2.5 text-sm font-semibold text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-50"
          onClick={() => nudge(5)}
        >
          Clean — go faster ⏫
        </button>
        <button
          disabled={saving}
          className="rounded-lg bg-[#e9e4d6] py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-white disabled:opacity-50"
          onClick={lock}
        >
          Lock in {bpm} bpm ✓
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-zinc-600">
        Play it to the click. Push the tempo as high as you can keep it clean,
        then lock it in — {reachedTarget ? "you're at target." : 'your best is what counts.'}
      </p>
    </div>
  )
}
