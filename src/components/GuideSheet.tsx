/**
 * The conventions sheet: how FretPath names strings, fingers, positions, and
 * rhythms. One modal, teacher-voice, referenced by every drill in the app.
 */

const STRINGS = [
  { number: 1, note: 'e', label: 'thinnest — "high e"' },
  { number: 2, note: 'B', label: '' },
  { number: 3, note: 'G', label: '' },
  { number: 4, note: 'D', label: '' },
  { number: 5, note: 'A', label: '' },
  { number: 6, note: 'E', label: 'thickest — "low E"' },
]

interface GuideSheetProps {
  onClose: () => void
}

export function GuideSheet({ onClose }: GuideSheetProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-xl font-black text-zinc-100">How to read the drills</h2>
          <button className="text-zinc-500 hover:text-zinc-300" onClick={onClose}>
            ✕
          </button>
        </div>

        <section className="mb-5">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-amber-400">
            Strings
          </h3>
          <p className="mb-2 text-sm text-zinc-400">
            Strings are numbered 1 to 6, thinnest to thickest. "Low" and "high"
            mean pitch, not position — the low E is the fat string closest to
            your face. Standard tuning unless a drill says otherwise.
          </p>
          <div className="rounded-lg bg-zinc-950 p-3 font-mono text-sm">
            {STRINGS.map((s) => (
              <div key={s.number} className="flex gap-3 text-zinc-300">
                <span className="w-4 text-zinc-500">{s.number}</span>
                <span className="w-4 font-bold">{s.note}</span>
                <span className="text-xs leading-5 text-zinc-600">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-5">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-amber-400">
            Fretting-hand fingers
          </h3>
          <p className="text-sm text-zinc-400">
            Numbered, always: <strong className="text-zinc-200">1</strong> index ·{' '}
            <strong className="text-zinc-200">2</strong> middle ·{' '}
            <strong className="text-zinc-200">3</strong> ring ·{' '}
            <strong className="text-zinc-200">4</strong> pinky. When a drill says
            "3rd finger", that's your ring finger. The picking hand keeps plain
            names: pick, thumb, index.
          </p>
        </section>

        <section className="mb-5">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-amber-400">
            Frets & positions
          </h3>
          <p className="text-sm text-zinc-400">
            Fret 0 is the open string. "6th string fret 3" means: fret the low E
            at the 3rd fret (that's a G). A <em>position</em> is where your 1st
            finger lives — in 5th position it covers the 5th fret and the other
            fingers take one fret each.
          </p>
        </section>

        <section className="mb-5">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-amber-400">
            Counting
          </h3>
          <div className="space-y-1 text-sm text-zinc-400">
            <p>Quarter notes: <span className="font-mono text-zinc-300">1&ensp;2&ensp;3&ensp;4</span> — one note per click.</p>
            <p>Eighth notes: <span className="font-mono text-zinc-300">1 & 2 & 3 & 4 &</span> — two per click.</p>
            <p>Sixteenths: <span className="font-mono text-zinc-300">1 e & a</span> — four per click.</p>
            <p>Triplets: <span className="font-mono text-zinc-300">1-trip-let</span> — three per click.</p>
            <p>
              The gallop: an eighth plus two sixteenths —{' '}
              <span className="font-mono text-zinc-300">1&ensp;&-a</span>.
            </p>
          </div>
        </section>

        <section className="mb-1">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-amber-400">
            How the app grades you
          </h3>
          <p className="mb-2 text-sm text-zinc-400">
            No 1–5 scores. Two kinds of item, two kinds of check:
          </p>
          <p className="mb-2 text-sm text-zinc-400">
            <strong className="text-zinc-200">Understanding checks</strong> —{' '}
            <em>Got it</em> or <em>Not yet</em>. Got it and you move on; Not yet
            just brings it back next time, no penalty. Nobody has to "master"
            reading a tab number.
          </p>
          <p className="text-sm text-zinc-400">
            <strong className="text-zinc-200">Metronome drills</strong> — push the
            tempo ladder as high as you can play it <em>clean</em>, then lock it
            in. Your best clean tempo is the score: reach the target and the skill
            is mastered; fall short and it comes back so you can push further.
            Lock in the tempo you actually played clean, not the one you wish you
            had.
          </p>
        </section>
      </div>
    </div>
  )
}
