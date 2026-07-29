/**
 * Metronome UI for the practice card. Mount with key={item.id} so switching
 * items unmounts the panel and the cleanup disposes the audio engine —
 * the click can never leak into the next item.
 */

import { useEffect, useRef, useState } from 'react'
import {
  clampBpm,
  Metronome,
  ticksPerBeatFor,
} from '../audio/metronome'

const SUB_LABEL: Record<number, string> = { 2: '8ths', 3: 'triplets', 4: '16ths' }

interface MetronomePanelProps {
  targetBpm: number
  subdivision?: string
}

export function MetronomePanel({ targetBpm, subdivision }: MetronomePanelProps) {
  const maxTicks = ticksPerBeatFor(subdivision)
  const [bpm, setBpm] = useState(() => clampBpm(targetBpm))
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

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Metronome
      </span>
      <button
        className={`rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
          running
            ? 'bg-red-700 text-white hover:bg-red-600'
            : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
        }`}
        onClick={toggle}
        aria-label={running ? 'Stop metronome' : 'Start metronome'}
      >
        {running ? '■ Stop' : '▶ Start'}
      </button>
      <div className="flex items-center gap-2">
        <button
          className="rounded-md bg-zinc-800 px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-700"
          onClick={() => nudge(-5)}
        >
          −5
        </button>
        <span className="w-16 text-center font-mono text-sm font-semibold text-zinc-100">
          {bpm} bpm
        </span>
        <button
          className="rounded-md bg-zinc-800 px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-700"
          onClick={() => nudge(5)}
        >
          +5
        </button>
      </div>
      {maxTicks > 1 && (
        <button
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
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
  )
}
