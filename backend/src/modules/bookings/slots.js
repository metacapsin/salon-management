// Booking ke time-slots ka hisaab. Abhi staff module nahi hai, isliye ek salon ek saath CAPACITY appointments le sakta hai.
// TODO(Staff module): capacity ki jagah asli staff ki shifts se hisaab.
const CAPACITY = 3
const STEP_MIN = 30
const MAX_DAYS_AHEAD = 30
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

// Salon ke timezone me abhi ki date aur minute
function nowInZone(timeZone, now = new Date()) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const get = (t) => Number(parts.find((p) => p.type === t).value)
  return { date, minutes: get('hour') * 60 + get('minute') }
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const isRealDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date

// date bookable hai? (aaj se 30 din ke andar)
function dateInRange(date, timeZone) {
  if (!isRealDate(date)) return false
  const today = nowInZone(timeZone).date
  return date >= today && date <= addDays(today, MAX_DAYS_AHEAD)
}

// Us din ke saare slots: [{ time:'10:30', available:true|false }]
function buildSlots({ date, durationMin, branch, bookings, timeZone, now, capacity = CAPACITY }) {
  if ((branch?.holidays ?? []).some((h) => h.date === date)) return []
  const dayKey = DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]
  const intervals = branch?.weeklyHours?.[dayKey] ?? []
  const current = nowInZone(timeZone, now)
  const slots = []
  for (const { start, end } of intervals) {
    for (let t = toMin(start); t + durationMin <= toMin(end); t += STEP_MIN) {
      const overlapping = bookings.filter((b) => toMin(b.startTime) < t + durationMin && t < toMin(b.startTime) + b.durationMin).length
      const past = date === current.date && t <= current.minutes
      slots.push({ time: toHHMM(t), available: !past && overlapping < capacity })
    }
  }
  return slots
}

module.exports = { CAPACITY, STEP_MIN, MAX_DAYS_AHEAD, buildSlots, dateInRange, isRealDate, toMin, nowInZone }
