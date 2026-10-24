import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Switch,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import { fieldErrorsOf, friendlyError } from '../api/client'
import { createStaff, deleteStaff, listServices, listStaff, updateStaff } from '../api/salonApi'
import { useAuth } from '../auth/AuthContext'
import { roleCan } from '../auth/permissions'
import QueryState from '../components/QueryState'
import { NAME_ERROR, NAME_PATTERN, PHONE_ERROR, isValidPhone } from '../utils/validators'
import ResponsiveTable from '../components/ResponsiveTable'

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

const SKILL_SUGGESTIONS = ['Haircut', 'Hair color', 'Hair spa', 'Facial', 'Cleanup', 'Waxing', 'Threading', 'Manicure', 'Pedicure', 'Bridal makeup', 'Party makeup', 'Mehendi', 'Massage', 'Beard trim', 'Shaving']

const emptyHours = () => Object.fromEntries(DAYS.map(([d]) => [d, []]))

// Table me chhota sa saaransh: "Mon–Sat 10:00–19:00" ki jagah din ginti
function hoursSummary(weeklyHours) {
  const days = DAYS.filter(([d]) => weeklyHours[d]?.length)
  if (days.length === 0) return 'No hours set'
  const first = weeklyHours[days[0][0]][0]
  return `${days.length} days a week · ${first.start}–${first.end}`
}

// Naya staff jodna ya purana badalna (staff=null matlab naya)
function StaffDialog({ staff, services, onClose, onSaved }) {
  const [name, setName] = useState(staff?.name ?? '')
  const [title, setTitle] = useState(staff?.title ?? '')
  const [phone, setPhone] = useState(staff?.phone ?? '')
  const [skills, setSkills] = useState(staff?.skills ?? [])
  const [serviceIds, setServiceIds] = useState(staff?.serviceIds ?? [])
  const [weekly, setWeekly] = useState(() => ({ ...emptyHours(), ...Object.fromEntries(DAYS.map(([d]) => [d, (staff?.weeklyHours?.[d] ?? []).map((i) => ({ ...i }))])) }))
  const [skillText, setSkillText] = useState('')
  const [problems, setProblems] = useState([])
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState({})

  // Name/phone ki galti field ke neeche dikhti hai (blur ya save ke baad)
  const fieldErrors = {}
  if (name.trim().length < 2) fieldErrors.name = 'Name must be at least 2 characters.'
  else if (!NAME_PATTERN.test(name.trim())) fieldErrors.name = NAME_ERROR
  if (phone.trim() && !isValidPhone(phone)) fieldErrors.phone = PHONE_ERROR
  const touch = (key) => setTouched((t) => ({ ...t, [key]: true }))
  const fieldProps = (key) => ({ onBlur: () => touch(key), error: Boolean(touched[key] && fieldErrors[key]), helperText: touched[key] ? fieldErrors[key] : undefined })

  const setDay = (day, fn) => setWeekly((w) => ({ ...w, [day]: fn(w[day]) }))
  const toggleService = (id) => setServiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  function localProblems() {
    const out = []
    for (const [day, label] of DAYS) {
      for (const it of weekly[day]) {
        if (!it.start || !it.end) out.push(`${label}: enter both start and end time.`)
        else if (toMinutes(it.start) >= toMinutes(it.end)) out.push(`${label}: end time must be after start time.`)
      }
    }
    return out
  }

  async function save() {
    const found = localProblems()
    setProblems(found)
    setTouched({ name: true, phone: true })
    if (found.length || Object.keys(fieldErrors).length) return
    const body = { name: name.trim(), title: title.trim(), phone: phone.trim(), skills, serviceIds, weeklyHours: weekly }
    setSaving(true)
    try {
      if (staff) await updateStaff(staff.id, body)
      else await createStaff(body)
      onSaved(staff ? 'Staff member updated.' : 'Staff member added.')
    } catch (error) {
      const fields = Object.values(fieldErrorsOf(error))
      setProblems(fields.length ? fields : [friendlyError(error)])
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        {staff ? 'Edit staff member' : 'Add a staff member'}
        <IconButton aria-label="Cancel" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        {problems.length > 0 && (
          <Alert severity="error">
            {problems.map((p) => (
              <div key={p}>{p}</div>
            ))}
          </Alert>
        )}
        <TextField size="small" label="Name" value={name} autoFocus onChange={(e) => setName(e.target.value)} {...fieldProps('name')} slotProps={{ htmlInput: { maxLength: 100 } }} />
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <TextField size="small" label="Role (e.g. Senior Stylist)" value={title} onChange={(e) => setTitle(e.target.value)} slotProps={{ htmlInput: { maxLength: 60 } }} />
          <TextField size="small" label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} {...fieldProps('phone')} slotProps={{ htmlInput: { maxLength: 20, inputMode: 'tel' } }} />
        </Box>
        <Autocomplete
          multiple
          freeSolo
          size="small"
          autoSelect
          options={SKILL_SUGGESTIONS.filter((k) => !skills.includes(k))}
          value={skills}
          onChange={(_, value) => setSkills([...new Set(value.map((v) => v.trim()).filter(Boolean))].slice(0, 20))}
          inputValue={skillText}
          onInputChange={(_, text, reason) => {
            // comma dabate hi skill judti hai aur box khaali ho jaata hai
            if (reason === 'input' && text.endsWith(',')) {
              const skill = text.slice(0, -1).trim()
              if (skill) setSkills((list) => (list.includes(skill) ? list : [...list, skill].slice(0, 20)))
              setSkillText('')
            } else {
              setSkillText(text)
            }
          }}
          renderInput={(params) => <TextField {...params} label="Skills" helperText="Type a skill and press Enter or comma, or pick from the list" />}
        />

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Services this person can do
          </Typography>
          {services.length === 0 ? (
            <Typography color="text.secondary">Add services first, then choose who can do them.</Typography>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              {services.map((s) => (
                <FormControlLabel key={s.id} control={<Checkbox checked={serviceIds.includes(s.id)} onChange={() => toggleService(s.id)} />} label={`${s.name} (${s.durationMin} min)`} />
              ))}
            </Box>
          )}
        </Box>

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Working hours
          </Typography>
          <Stack spacing={1.5}>
            {DAYS.map(([day, label]) => (
              <Box key={day} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                <Typography sx={{ width: { xs: '100%', sm: 110 }, fontWeight: 600 }}>{label}</Typography>
                {weekly[day].length === 0 && <Typography color="text.secondary">Day off</Typography>}
                {weekly[day].map((it, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', width: { xs: '100%', sm: 'auto' } }}>
                    <TextField
                      type="time"
                      size="small"
                      label="Starts"
                      value={it.start}
                      onChange={(e) => setDay(day, (list) => list.map((x, i) => (i === index ? { ...x, start: e.target.value } : x)))}
                      slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300, 'aria-label': `${label} starts` } }}
                      sx={{ flex: '1 1 100px', minWidth: 0, width: { sm: 140 }, flexGrow: { sm: 0 } }}
                    />
                    <TextField
                      type="time"
                      size="small"
                      label="Ends"
                      value={it.end}
                      onChange={(e) => setDay(day, (list) => list.map((x, i) => (i === index ? { ...x, end: e.target.value } : x)))}
                      slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300, 'aria-label': `${label} ends` } }}
                      sx={{ flex: '1 1 100px', minWidth: 0, width: { sm: 140 }, flexGrow: { sm: 0 } }}
                    />
                    <IconButton aria-label={`Remove ${label} hours`} onClick={() => setDay(day, (list) => list.filter((_, i) => i !== index))}>
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}
                <Button size="small" onClick={() => setDay(day, (list) => [...list, { start: '10:00', end: '19:00' }])}>
                  {weekly[day].length === 0 ? 'Set hours' : 'Add interval'}
                </Button>
              </Box>
            ))}
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save staff member'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// Salon ke beautician. Owner/Manager badal sakte hain; receptionist sirf dekh sakta hai.
export default function StaffPage() {
  const { role, activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const canWrite = roleCan(role, 'staff.write')
  const [editing, setEditing] = useState(undefined) // undefined = dialog band, null = naya, object = badalna
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [deleting, setDeleting] = useState(null) // jise hatane ke liye poochh rahe hain

  const query = useQuery({ queryKey: ['salon', activeSalonId, 'staff'], queryFn: listStaff })
  const servicesQuery = useQuery({ queryKey: ['salon', activeSalonId, 'services'], queryFn: listServices })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['salon', activeSalonId] })

  const toggle = useMutation({
    mutationFn: ({ id, active }) => updateStaff(id, { active }),
    onSuccess: () => {
      setActionError('')
      refresh()
    },
    onError: (error) => setActionError(friendlyError(error)),
  })

  const remove = useMutation({
    mutationFn: (id) => deleteStaff(id),
    onSuccess: () => {
      setDeleting(null)
      setNotice('Staff member deleted.')
      refresh()
    },
    onError: (error) => {
      setDeleting(null)
      setActionError(friendlyError(error))
    },
  })

  const staff = query.data?.staff ?? []
  const services = (servicesQuery.data?.services ?? []).filter((s) => s.active)
  const serviceName = (id) => servicesQuery.data?.services.find((s) => s.id === id)?.name

  return (
    <Box sx={{ maxWidth: 1000 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800, color: 'primary.main', flexGrow: 1 }}>
          Staff
        </Typography>
        {canWrite && (
          <Button variant="contained" onClick={() => setEditing(null)}>
            Add staff
          </Button>
        )}
      </Box>
      {!canWrite && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You can see your team. Only the owner or a manager can change it.
        </Alert>
      )}
      {actionError && (
        <Alert severity="error" onClose={() => setActionError('')} sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      <QueryState
        query={query}
        isEmpty={staff.length === 0}
        empty={<Alert severity="info">No staff yet. {canWrite ? 'Add your beauticians so customers can book time slots.' : ''}</Alert>}
      >
        <TableContainer component={Paper}>
          <ResponsiveTable size="small" aria-label="Staff">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Skills</TableCell>
                <TableCell>Services</TableCell>
                <TableCell>Working hours</TableCell>
                <TableCell>Active</TableCell>
                {canWrite && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {staff.map((s) => (
                <TableRow key={s.id} sx={{ opacity: s.active ? 1 : 0.55 }}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600 }}>{s.name}</Typography>
                    {(s.title || s.phone) && (
                      <Typography variant="caption" color="text.secondary">
                        {[s.title, s.phone].filter(Boolean).join(' · ')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.skills.length === 0 ? '—' : s.skills.map((k) => <Chip key={k} size="small" label={k} sx={{ mr: 0.5, mb: 0.5 }} />)}
                  </TableCell>
                  <TableCell>
                    {s.serviceIds.length === 0 ? '—' : s.serviceIds.map((id) => serviceName(id)).filter(Boolean).join(', ')}
                  </TableCell>
                  <TableCell>{hoursSummary(s.weeklyHours)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={s.active}
                      disabled={!canWrite || toggle.isPending}
                      onChange={(e) => toggle.mutate({ id: s.id, active: e.target.checked })}
                      slotProps={{ input: { 'aria-label': `${s.name} active` } }}
                    />
                  </TableCell>
                  {canWrite && (
                    <TableCell align="right">
                      <Button size="small" onClick={() => setEditing(s)}>
                        Edit
                      </Button>
                      <Button size="small" color="error" onClick={() => setDeleting(s)}>
                        Delete
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </ResponsiveTable>
        </TableContainer>
      </QueryState>

      {editing !== undefined && (
        <StaffDialog
          staff={editing}
          services={services}
          onClose={() => setEditing(undefined)}
          onSaved={(message) => {
            setEditing(undefined)
            setNotice(message)
            refresh()
          }}
        />
      )}
      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)}>
        <DialogTitle>Delete {deleting?.name}?</DialogTitle>
        <DialogContent>
          <Typography>This removes the staff member for good. To only stop them taking bookings, switch Active off instead.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={remove.isPending} onClick={() => remove.mutate(deleting.id)}>
            {remove.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={Boolean(notice)} autoHideDuration={3000} onClose={() => setNotice('')} message={notice} />
    </Box>
  )
}
