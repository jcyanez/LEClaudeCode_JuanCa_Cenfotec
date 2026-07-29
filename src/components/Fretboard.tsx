/**
 * Interactive SVG fretboard: 6 strings × 15 frets (+ open position), tappable.
 * Tab orientation — string 1 (high e) on top, string 6 (low E) at the bottom.
 *
 * Two mark layers:
 * - userMarks: positions the user tapped while answering (cyan).
 * - markers:   the revealed answer positions (amber; green where they agree
 *              with a user mark).
 */

export interface FretMarker {
  /** 1 = high e … 6 = low E */
  string: number
  /** 0 = open string */
  fret: number
  label?: string
}

export function posKey(string: number, fret: number): string {
  return `${string}-${fret}`
}

/**
 * Best-effort extraction of fretboard positions from an item's authored
 * metadata. Supports the seed's two shapes:
 * - frets as an array + a single-string `strings` array (runs on one string)
 * - frets as an object: stringNumber → fret or fret[]
 */
export function markersFromMetadata(
  metadata: Record<string, unknown>,
): FretMarker[] {
  const markers: FretMarker[] = []
  const frets = metadata.frets
  const strings = metadata.strings
  const notes = Array.isArray(metadata.notes) ? (metadata.notes as string[]) : []

  if (Array.isArray(frets) && Array.isArray(strings) && strings.length === 1) {
    const string = Number(strings[0])
    frets.forEach((fret, index) => {
      markers.push({ string, fret: Number(fret), label: notes[index] })
    })
  } else if (frets && typeof frets === 'object' && !Array.isArray(frets)) {
    for (const [stringKey, value] of Object.entries(frets)) {
      const string = Number(stringKey)
      const list = Array.isArray(value) ? value : [value]
      for (const fret of list) markers.push({ string, fret: Number(fret) })
    }
  }
  return markers.filter(
    (m) =>
      Number.isFinite(m.string) && m.string >= 1 && m.string <= 6 &&
      Number.isFinite(m.fret) && m.fret >= 0 && m.fret <= FRET_COUNT,
  )
}

const FRET_COUNT = 15
const NUT_X = 56
const FRET_W = 57
const STRING_TOP = 30
const STRING_GAP = 30
const BOARD_RIGHT = NUT_X + FRET_COUNT * FRET_W // 911
const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E'] // string 1 → 6
const INLAY_FRETS = [3, 5, 7, 9, 15]

const stringY = (string: number) => STRING_TOP + (string - 1) * STRING_GAP
const markX = (fret: number) =>
  fret === 0 ? NUT_X - 20 : NUT_X + (fret - 0.5) * FRET_W

interface FretboardProps {
  /** Revealed answer positions (shown amber). */
  markers?: FretMarker[]
  /** Keys ("string-fret") the user has tapped. */
  userMarks: ReadonlySet<string>
  onToggle?: (string: number, fret: number) => void
  disabled?: boolean
}

export function Fretboard({
  markers = [],
  userMarks,
  onToggle,
  disabled = false,
}: FretboardProps) {
  const answerKeys = new Set(markers.map((m) => posKey(m.string, m.fret)))
  const strings = [1, 2, 3, 4, 5, 6]
  const frets = Array.from({ length: FRET_COUNT + 1 }, (_, i) => i)
  const midY = (stringY(1) + stringY(6)) / 2

  return (
    <svg
      viewBox="0 0 940 218"
      className="w-full select-none"
      role="img"
      aria-label="Guitar fretboard"
    >
      {/* Board background */}
      <rect
        x={NUT_X}
        y={stringY(1) - 12}
        width={BOARD_RIGHT - NUT_X}
        height={stringY(6) - stringY(1) + 24}
        rx={4}
        className="fill-zinc-900"
      />

      {/* Inlay dots */}
      {INLAY_FRETS.map((f) => (
        <circle
          key={f}
          cx={markX(f)}
          cy={midY}
          r={5}
          className="fill-zinc-700"
        />
      ))}
      <circle cx={markX(12)} cy={midY - 45} r={5} className="fill-zinc-700" />
      <circle cx={markX(12)} cy={midY + 45} r={5} className="fill-zinc-700" />

      {/* Nut + fret wires */}
      {frets.map((f) => (
        <line
          key={f}
          x1={NUT_X + f * FRET_W}
          y1={stringY(1) - 12}
          x2={NUT_X + f * FRET_W}
          y2={stringY(6) + 12}
          className={f === 0 ? 'stroke-zinc-300' : 'stroke-zinc-600'}
          strokeWidth={f === 0 ? 5 : 2}
        />
      ))}

      {/* Fret numbers */}
      {frets
        .filter((f) => f > 0)
        .map((f) => (
          <text
            key={f}
            x={markX(f)}
            y={stringY(6) + 34}
            textAnchor="middle"
            className="fill-zinc-500 text-[11px]"
          >
            {f}
          </text>
        ))}

      {/* Strings (thicker toward low E) + name labels */}
      {strings.map((s) => (
        <g key={s}>
          <text
            x={14}
            y={stringY(s) + 4}
            textAnchor="middle"
            className="fill-zinc-400 text-[12px] font-mono"
          >
            {STRING_NAMES[s - 1]}
          </text>
          <line
            x1={NUT_X}
            y1={stringY(s)}
            x2={BOARD_RIGHT}
            y2={stringY(s)}
            className="stroke-zinc-400"
            strokeWidth={0.8 + (s - 1) * 0.45}
          />
        </g>
      ))}

      {/* Tap targets */}
      {!disabled &&
        onToggle &&
        strings.map((s) =>
          frets.map((f) => (
            <rect
              key={posKey(s, f)}
              x={f === 0 ? NUT_X - 34 : NUT_X + (f - 1) * FRET_W}
              y={stringY(s) - STRING_GAP / 2}
              width={f === 0 ? 32 : FRET_W}
              height={STRING_GAP}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => onToggle(s, f)}
            />
          )),
        )}

      {/* User marks */}
      {[...userMarks].map((key) => {
        const [s, f] = key.split('-').map(Number)
        if (!s || f === undefined) return null
        const isAlsoAnswer = answerKeys.has(key)
        return (
          <circle
            key={`u-${key}`}
            cx={markX(f)}
            cy={stringY(s)}
            r={10}
            className={
              isAlsoAnswer
                ? 'fill-emerald-500/80 stroke-emerald-300'
                : 'fill-cyan-500/70 stroke-cyan-300'
            }
            strokeWidth={1.5}
            pointerEvents="none"
          />
        )
      })}

      {/* Answer markers */}
      {markers.map((m) => {
        const key = posKey(m.string, m.fret)
        const matched = userMarks.has(key)
        return (
          <g key={`a-${key}`} pointerEvents="none">
            <circle
              cx={markX(m.fret)}
              cy={stringY(m.string)}
              r={11}
              fill={matched ? 'none' : 'rgba(251,191,36,0.25)'}
              className={matched ? 'stroke-emerald-300' : 'stroke-amber-400'}
              strokeWidth={2}
            />
            {m.label && (
              <text
                x={markX(m.fret)}
                y={stringY(m.string) + 3.5}
                textAnchor="middle"
                className="fill-amber-200 text-[9px] font-semibold"
              >
                {m.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
