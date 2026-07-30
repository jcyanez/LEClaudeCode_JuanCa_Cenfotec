/**
 * Web Audio metronome with lookahead scheduling.
 *
 * Why not setInterval-per-click: JS timers jitter by tens of milliseconds,
 * which is audibly sloppy. Instead a coarse timer (25 ms) runs a scheduler
 * that books clicks up to 100 ms ahead on the AudioContext's own
 * sample-accurate clock — the standard "tale of two clocks" pattern.
 *
 * Framework-agnostic (no React). The Expo port swaps this driver for a
 * native-audio implementation with the same public surface.
 */

export const MIN_BPM = 40
export const MAX_BPM = 208

export function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)))
}

/** Seconds between consecutive ticks. */
export function tickIntervalSeconds(bpm: number, ticksPerBeat: number): number {
  return 60 / clampBpm(bpm) / ticksPerBeat
}

/** Map item metadata.subdivision to ticks per beat. */
export function ticksPerBeatFor(subdivision: string | undefined): number {
  switch (subdivision) {
    case 'eighth':
      return 2
    case 'triplet':
      return 3
    case 'sixteenth':
      return 4
    default:
      return 1
  }
}

const LOOKAHEAD_S = 0.1
const TIMER_MS = 25
const CLICK_S = 0.03

type TickKind = 'accent' | 'beat' | 'sub'
const TICK_FREQ: Record<TickKind, number> = { accent: 1660, beat: 1108, sub: 830 }
const TICK_GAIN: Record<TickKind, number> = { accent: 0.5, beat: 0.35, sub: 0.16 }

export class Metronome {
  private ctx: AudioContext | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private nextTickTime = 0
  private tick = 0
  private _bpm: number
  private _ticksPerBeat: number
  readonly beatsPerBar: number

  constructor(bpm: number, ticksPerBeat = 1, beatsPerBar = 4) {
    this._bpm = clampBpm(bpm)
    this._ticksPerBeat = ticksPerBeat
    this.beatsPerBar = beatsPerBar
  }

  get bpm(): number {
    return this._bpm
  }

  /** Takes effect from the next scheduled tick — safe while running. */
  setBpm(bpm: number): void {
    this._bpm = clampBpm(bpm)
  }

  setTicksPerBeat(ticksPerBeat: number): void {
    this._ticksPerBeat = Math.max(1, Math.round(ticksPerBeat))
  }

  get isRunning(): boolean {
    return this.timer !== null
  }

  start(): void {
    if (this.timer !== null) return
    this.ctx ??= new AudioContext()
    void this.ctx.resume() // browsers suspend contexts created outside a gesture
    this.tick = 0
    this.nextTickTime = this.ctx.currentTime + 0.06
    this.timer = setInterval(() => this.schedule(), TIMER_MS)
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  dispose(): void {
    this.stop()
    void this.ctx?.close()
    this.ctx = null
  }

  private schedule(): void {
    const ctx = this.ctx!
    while (this.nextTickTime < ctx.currentTime + LOOKAHEAD_S) {
      this.click(this.nextTickTime, this.kindFor(this.tick))
      this.nextTickTime += tickIntervalSeconds(this._bpm, this._ticksPerBeat)
      this.tick += 1
    }
  }

  private kindFor(tick: number): TickKind {
    const ticksPerBar = this._ticksPerBeat * this.beatsPerBar
    if (tick % ticksPerBar === 0) return 'accent'
    return tick % this._ticksPerBeat === 0 ? 'beat' : 'sub'
  }

  private click(time: number, kind: TickKind): void {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = TICK_FREQ[kind]
    gain.gain.setValueAtTime(TICK_GAIN[kind], time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + CLICK_S)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(time)
    osc.stop(time + CLICK_S + 0.01)
  }
}
