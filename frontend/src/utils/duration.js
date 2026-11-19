// Duration hamesha minutes (integer) me store hoti hai. Ye helpers sirf dikhane/convert karne ke liye hain.

// 30 -> "30 min", 60 -> "1 hour", 90 -> "1 hour 30 min", 120 -> "2 hours"
export function formatDuration(totalMin) {
  const total = Math.round(Number(totalMin))
  if (!Number.isFinite(total) || total <= 0) return '0 min'
  const hours = Math.floor(total / 60)
  const mins = total % 60
  const parts = []
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`)
  if (mins > 0) parts.push(`${mins} min`)
  return parts.join(' ')
}

// 90 -> { hours: 1, minutes: 30 }
export function splitDuration(totalMin) {
  const total = Math.max(0, Math.round(Number(totalMin)) || 0)
  return { hours: Math.floor(total / 60), minutes: total % 60 }
}

// (1, 30) -> 90. Khali/galat input ko 0 maana jaata hai.
export function joinDuration(hours, minutes) {
  const h = Number(hours)
  const m = Number(minutes)
  return (Number.isFinite(h) ? Math.max(0, Math.floor(h)) : 0) * 60 + (Number.isFinite(m) ? Math.max(0, Math.floor(m)) : 0)
}
