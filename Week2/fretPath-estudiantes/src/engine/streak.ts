/**
 * Practice-streak computation: consecutive local-calendar days with at least
 * one recorded session. A streak is still "alive" if the user practiced
 * yesterday but hasn't yet today — it only breaks after a full missed day.
 *
 * Pure function over session timestamps; uses the environment's local
 * timezone via Date (practice days are the user's days, not UTC days).
 */

function dayKey(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayKeyDaysAgo(now: number, daysAgo: number): string {
  const d = new Date(now)
  d.setDate(d.getDate() - daysAgo)
  return dayKey(d.getTime())
}

export function computeStreak(sessionDates: number[], now: number): number {
  if (sessionDates.length === 0) return 0
  const practiced = new Set(sessionDates.map(dayKey))

  // Anchor on today if practiced today, else on yesterday (streak alive);
  // if neither day has a session, the streak is broken.
  let offset: number
  if (practiced.has(dayKeyDaysAgo(now, 0))) offset = 0
  else if (practiced.has(dayKeyDaysAgo(now, 1))) offset = 1
  else return 0

  let streak = 0
  while (practiced.has(dayKeyDaysAgo(now, offset))) {
    streak += 1
    offset += 1
  }
  return streak
}
