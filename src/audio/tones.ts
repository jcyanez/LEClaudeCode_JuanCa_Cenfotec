/**
 * Reference tones for tuning: one oscillator per plucked "string", with a
 * fast attack and slow exponential release so it reads as a tone, not a beep.
 * Frequencies are equal-temperament standards (A4 = 440 Hz).
 */

export interface StringTone {
  /** 1 = high e … 6 = low E */
  string: number
  name: string
  frequency: number
}

export const STANDARD_TUNING: StringTone[] = [
  { string: 6, name: 'E2', frequency: 82.41 },
  { string: 5, name: 'A2', frequency: 110.0 },
  { string: 4, name: 'D3', frequency: 146.83 },
  { string: 3, name: 'G3', frequency: 196.0 },
  { string: 2, name: 'B3', frequency: 246.94 },
  { string: 1, name: 'E4', frequency: 329.63 },
]

/** Drop D: only the 6th string changes, down a whole step. */
export const DROP_D_SIXTH: StringTone = { string: 6, name: 'D2', frequency: 73.42 }

let ctx: AudioContext | null = null

/** Play a tone for ~2 s. Must be called from a user gesture (mobile audio policy). */
export function playTone(frequency: number, seconds = 2): void {
  ctx ??= new AudioContext()
  void ctx.resume()
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle' // softer than square/saw, more overtones than sine
  osc.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t)
  osc.stop(t + seconds + 0.05)
}
