/**
 * Tuning reference: six buttons that play each string's pitch. When the
 * active tuning is Drop D, the 6th string plays D2 and is highlighted.
 */

import { DROP_D_SIXTH, playTone, STANDARD_TUNING } from '../audio/tones'

interface TuningPanelProps {
  /** Item metadata tuning, e.g. "Drop D". Undefined = standard. */
  tuning?: string
}

export function TuningPanel({ tuning }: TuningPanelProps) {
  const isDropD = tuning?.toLowerCase() === 'drop d'
  const tones = STANDARD_TUNING.map((tone) =>
    isDropD && tone.string === 6 ? DROP_D_SIXTH : tone,
  )

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Tuning{isDropD ? ' · Drop D' : ''}
      </span>
      {tones.map((tone) => (
        <button
          key={tone.string}
          className={`rounded-md px-2.5 py-1.5 font-mono text-xs font-semibold transition-colors ${
            isDropD && tone.string === 6
              ? 'bg-amber-900/60 text-amber-300 hover:bg-amber-900'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
          onClick={() => playTone(tone.frequency)}
          title={`Play ${tone.name} (${tone.frequency} Hz)`}
        >
          {tone.string} · {tone.name}
        </button>
      ))}
    </div>
  )
}
