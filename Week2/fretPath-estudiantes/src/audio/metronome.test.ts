import { describe, expect, it } from 'vitest'
import {
  clampBpm,
  MAX_BPM,
  MIN_BPM,
  tickIntervalSeconds,
  ticksPerBeatFor,
} from './metronome'

describe('clampBpm', () => {
  it('clamps to the supported range and rounds', () => {
    expect(clampBpm(10)).toBe(MIN_BPM)
    expect(clampBpm(500)).toBe(MAX_BPM)
    expect(clampBpm(82.6)).toBe(83)
    expect(clampBpm(120)).toBe(120)
  })
})

describe('tickIntervalSeconds', () => {
  it('60 bpm quarters = 1 s; 120 bpm eighths = 0.25 s', () => {
    expect(tickIntervalSeconds(60, 1)).toBe(1)
    expect(tickIntervalSeconds(120, 2)).toBe(0.25)
    expect(tickIntervalSeconds(90, 3)).toBeCloseTo(60 / 90 / 3, 10)
  })
})

describe('ticksPerBeatFor', () => {
  it('maps item subdivision metadata to ticks per beat', () => {
    expect(ticksPerBeatFor('quarter')).toBe(1)
    expect(ticksPerBeatFor('eighth')).toBe(2)
    expect(ticksPerBeatFor('triplet')).toBe(3)
    expect(ticksPerBeatFor('sixteenth')).toBe(4)
    expect(ticksPerBeatFor(undefined)).toBe(1)
    expect(ticksPerBeatFor('weird')).toBe(1)
  })
})
