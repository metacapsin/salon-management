import { useState } from 'react'
import { Alert, Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import { fieldErrorsOf, friendlyError } from '../../api/client'

const DAYS = [
  ['mon', 'Monday'],
  ['tue', 'Tuesday'],
  ['wed', 'Wednesday'],
  ['thu', 'Thursday'],
  ['fri', 'Friday'],
  ['sat', 'Saturday'],
  ['sun', 'Sunday'],
]

const toMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))

// Opening hours + holidays. Khaali din = band. Ek din me kai intervals ho sakte hain (jaise lunch break).
// Props: initial = { weeklyHours, holidays }, onSave(values) -> Promise, readOnly, saveLabel
export default function HoursEditor({ initial, onSave, readOnly = false, saveLabel = 'Save hours' }) {
  const [weekly, setWeekly] = useState(() => Object.fromEntries(DAYS.map(([d]) => [d, (initial.weeklyHours?.[d] ?? []).map((i) => ({ ...i }))])))
  const [holidays, setHolidays] = useState(() => (initial.holidays ?? []).map((h) => ({ ...h })))
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' })
  const [problems, setProblems] = useState([])
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const touch = () => setSaved(false)
  const updateInterval = (day, index, patch) => {
    touch()
    setWeekly((w) => ({ ...w, [day]: w[day].map((it, i) => (i === index ? { ...it, ...patch } : it)) }))
  }
  const addInterval = (day) => {
    touch()
    setWeekly((w) => ({ ...w, [day]: [...w[day], { start: '10:00', end: '20:00' }] }))
  }
  const removeInterval = (day, index) => {
    touch()
    setWeekly((w) => ({ ...w, [day]: w[day].filter((_, i) => i !== index) }))
  }

  function localProblems() {
    const out = []
    for (const [day, label] of DAYS) {
      for (const it of weekly[day]) {
        if (!it.start || !it.end) out.push(`${label}: enter both opening and closing time.`)
        else if (toMinutes(it.start) >= toMinutes(it.end)) out.push(`${label}: closing time must be after opening time.`)
      }
    }
    return out
  }

  async function save() {
    const found = localProblems()
    setProblems(found)
    if (found.length) return
    setSaving(true)
    try {
      await onSave({ weeklyHours: weekly, holidays })
      setSaved(true)
    } catch (error) {
      const fields = Object.values(fieldErrorsOf(error))
      setProblems(fields.length ? fields : [friendlyError(error)])
    } finally {
      setSaving(false)
    }
  }

  function addHoliday() {
    if (!newHoliday.date) return setProblems(['Pick a date for the holiday.'])
    if (holidays.some((h) => h.date === newHoliday.date)) return setProblems(['That holiday date is already added.'])
    touch()
    setProblems([])
    setHolidays((list) => [...list, newHoliday].sort((a, b) => a.date.localeCompare(b.date)))
    setNewHoliday({ date: '', name: '' })
  }

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        Weekly opening hours
      </Typography>
      <Stack spacing={1.5}>
        {DAYS.map(([day, label]) => (
          <Box key={day} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Typography sx={{ width: { xs: '100%', sm: 110 }, fontWeight: 600 }}>{label}</Typography>
            {weekly[day].length === 0 && <Typography color="text.secondary">Closed</Typography>}
            {weekly[day].map((it, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', width: { xs: '100%', sm: 'auto' } }}>
                <TextField
                  type="time"
                  size="small"
                  label="Opens"
                  value={it.start}
                  disabled={readOnly}
                  onChange={(e) => updateInterval(day, index, { start: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300, 'aria-label': `${label} opens` } }}
                  sx={{ flex: '1 1 100px', minWidth: 0, width: { sm: 140 }, flexGrow: { sm: 0 } }}
                />
                <TextField
                  type="time"
                  size="small"
                  label="Closes"
                  value={it.end}
                  disabled={readOnly}
                  onChange={(e) => updateInterval(day, index, { end: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300, 'aria-label': `${label} closes` } }}
                  sx={{ flex: '1 1 100px', minWidth: 0, width: { sm: 140 }, flexGrow: { sm: 0 } }}
                />
                {!readOnly && (
                  <IconButton aria-label={`Remove ${label} hours`} onClick={() => removeInterval(day, index)}>
                    <DeleteIcon />
                  </IconButton>
                )}
              </Box>
            ))}
            {!readOnly && (
              <Button size="small" onClick={() => addInterval(day)}>
                {weekly[day].length === 0 ? 'Set hours' : 'Add interval'}
              </Button>
            )}
          </Box>
        ))}
      </Stack>

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 3, mb: 1 }}>
        Holidays
      </Typography>
      {holidays.length === 0 && <Typography color="text.secondary">No holidays added.</Typography>}
      <Stack spacing={0.5}>
        {holidays.map((h) => (
          <Box key={h.date} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ minWidth: 110 }}>{h.date}</Typography>
            <Typography color="text.secondary" sx={{ flexGrow: 1 }}>
              {h.name}
            </Typography>
            {!readOnly && (
              <IconButton
                aria-label={`Remove holiday ${h.date}`}
                onClick={() => {
                  touch()
                  setHolidays((list) => list.filter((x) => x.date !== h.date))
                }}
              >
                <DeleteIcon />
              </IconButton>
            )}
          </Box>
        ))}
      </Stack>
      {!readOnly && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5, alignItems: 'center' }}>
          <TextField
            type="date"
            size="small"
            label="Date"
            value={newHoliday.date}
            onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: { xs: '100%', sm: 170 } }}
          />
          <TextField size="small" label="Name (optional)" value={newHoliday.name} onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })} sx={{ width: { xs: '100%', sm: 220 } }} slotProps={{ htmlInput: { maxLength: 100 } }} />
          <Button variant="outlined" onClick={addHoliday}>
            Add holiday
          </Button>
        </Box>
      )}

      {problems.length > 0 && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {problems.map((p) => (
            <div key={p}>{p}</div>
          ))}
        </Alert>
      )}
      {saved && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Opening hours saved.
        </Alert>
      )}
      {!readOnly && (
        <Button variant="contained" sx={{ mt: 2 }} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : saveLabel}
        </Button>
      )}
    </Box>
  )
}
