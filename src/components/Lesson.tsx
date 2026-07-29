/**
 * Teach-first lesson card, shown once before a node's first drill in a session
 * (and re-openable later). Read it, then tap through to the drill. Content is
 * short teacher-voice paragraphs today; the block shape leaves room for
 * diagrams/audio later.
 */

import type { Lesson as LessonContent } from '../data/loader'

interface LessonProps {
  nodeName: string
  lesson: LessonContent
  /** Label for the continue button — "Start the drills" first time, else "Got it". */
  ctaLabel: string
  onContinue: () => void
}

export function Lesson({ nodeName, lesson, ctaLabel, onContinue }: LessonProps) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-500">
          Lesson
        </div>
        <h2
          className="mb-4 text-3xl text-[#e9e4d6]"
          style={{ fontFamily: "'Pirata One', Georgia, serif" }}
        >
          {nodeName}
        </h2>
        <div className="space-y-3">
          {lesson.blocks.map((block, i) => (
            <p key={i} className="text-base leading-relaxed text-zinc-200">
              {block}
            </p>
          ))}
        </div>
        <button
          className="mt-6 w-full rounded-lg bg-[#e9e4d6] py-3 font-semibold text-zinc-950 transition-colors hover:bg-white"
          onClick={onContinue}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  )
}
