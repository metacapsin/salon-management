import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Box, Button, Checkbox, Chip, FormControlLabel, FormHelperText, Radio, RadioGroup, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { ApiError, fieldErrorsOf, friendlyError } from '../../api/client'
import { createBooking, getSlots } from '../../api/publicApi'
import { useCustomer } from '../../customer/CustomerAuthContext'
import { formatMoney } from '../../utils/formatMoney'
import { ADDRESS_ERROR, ADDRESS_PATTERN } from '../../utils/validators'
import OfferList, { discountFor } from './OfferList'

// yyyy-mm-dd, customer ke aaj se n din baad
const dayString = (offset) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('en-CA')
}

// Appointment book karne ka form: service -> kahan -> din -> samay -> confirm.
// Naam aur mobile number logged-in customer ke account se aate hain (OTP se verify hue), isliye yahan nahi puchhte.
export default function BookingForm({ salon, onBooked }) {
  const { customer } = useCustomer()
  const supportsHome = salon.services.some((s) => s.atHome)
  const [mode, setMode] = useState('salon')
  const [picked, setPicked] = useState([])
  const [date, setDate] = useState(dayString(1))
  const [time, setTime] = useState('')
  const [form, setForm] = useState({ address: '', note: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [offerChoice, setOfferChoice] = useState('auto') // 'auto' | 'none' | offer id

  const available = salon.services.filter((s) => (mode === 'home' ? s.atHome : s.atSalon))
  const chosen = available.filter((s) => picked.includes(s.id))
  const subtotal = chosen.reduce((sum, s) => sum + s.price, 0)
  // Chuni hui services par lagne wale offers; customer ne kuch nahi chuna ('auto') to sabse zyada bachat wala apne-aap lagta hai
  const usable = (salon.offers ?? []).map((o) => ({ offer: o, discount: discountFor(o, chosen) })).filter((x) => x.discount > 0)
  const best = usable.reduce((top, x) => (!top || x.discount > top.discount ? x : top), null)
  const applied = offerChoice === 'none' ? null : (usable.find((x) => x.offer.id === offerChoice) ?? best)
  const total = subtotal - (applied?.discount ?? 0)
  const duration = chosen.reduce((sum, s) => sum + s.durationMin, 0)

  const slotsQuery = useQuery({
    queryKey: ['public', 'slots', salon.id, date, duration],
    queryFn: () => getSlots(salon.id, date, duration),
    enabled: duration > 0 && Boolean(date),
  })
  const slots = slotsQuery.data ?? []

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const toggleService = (id) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
    setTime('')
  }
  const changeMode = (_, next) => {
    if (!next) return
    setMode(next)
    setPicked([])
    setTime('')
  }

  // Address: kam se kam 8 characters, aur sirf allowed characters (number zaroori nahi)
  function addressProblem(address) {
    const text = address.trim()
    if (text.length < 8) return 'Enter your full address.'
    if (!ADDRESS_PATTERN.test(text.replace(/\s+/g, ' '))) return ADDRESS_ERROR
    return ''
  }

  async function submit(e) {
    e.preventDefault()
    const next = {}
    if (chosen.length === 0) next.serviceIds = 'Choose at least one service.'
    if (!time) next.startTime = 'Choose a time.'
    if (mode === 'home' && addressProblem(form.address)) next.address = addressProblem(form.address)
    setErrors(next)
    setFormError('')
    if (Object.keys(next).length > 0) return

    setSaving(true)
    try {
      const booking = await createBooking(salon.id, { ...form, mode, date, startTime: time, serviceIds: chosen.map((s) => s.id), ...(applied ? { offerId: applied.offer.id } : {}) })
      onBooked(booking)
    } catch (error) {
      setErrors(fieldErrorsOf(error))
      setFormError(friendlyError(error))
      if (error instanceof ApiError && error.code === 'SLOT_UNAVAILABLE') {
        setTime('')
        slotsQuery.refetch()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box component="form" onSubmit={submit} noValidate sx={{ display: 'grid', gap: 2 }}>
      {formError && <Alert severity="error">{formError}</Alert>}

      {supportsHome && (
        <ToggleButtonGroup exclusive size="small" value={mode} onChange={changeMode} aria-label="Where do you want the service">
          <ToggleButton value="salon">🏪 At the salon</ToggleButton>
          <ToggleButton value="home">🏠 At my home</ToggleButton>
        </ToggleButtonGroup>
      )}

      <OfferList offers={salon.offers} services={salon.services} />

      <Box>
        <Typography variant="subtitle2">1. Choose services</Typography>
        {available.length === 0 && <Typography color="text.secondary">No services are available for this option.</Typography>}
        {available.map((s) => (
          <FormControlLabel
            key={s.id}
            sx={{ display: 'flex', mr: 0, '& .MuiFormControlLabel-label': { flexGrow: 1 } }}
            control={<Checkbox checked={picked.includes(s.id)} onChange={() => toggleService(s.id)} />}
            label={
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <span>
                  {s.name} <Typography component="span" variant="caption" color="text.secondary">· {s.durationMin} min</Typography>
                </span>
                <strong>{formatMoney(s.price)}</strong>
              </Box>
            }
          />
        ))}
        {errors.serviceIds && <FormHelperText error>{errors.serviceIds}</FormHelperText>}
        {usable.length > 0 && (
          <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, bgcolor: '#fff8e6', border: '1px dashed #c9a24a' }}>
            <Typography variant="subtitle2">🏷️ Apply an offer</Typography>
            <RadioGroup value={applied?.offer.id ?? 'none'} onChange={(e) => setOfferChoice(e.target.value)}>
              {usable.map(({ offer, discount }) => (
                <FormControlLabel key={offer.id} value={offer.id} control={<Radio size="small" />} label={`${offer.title}: save ${formatMoney(discount)}`} />
              ))}
              <FormControlLabel value="none" control={<Radio size="small" />} label="No offer" />
            </RadioGroup>
          </Box>
        )}
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          2. Pick a day and time
        </Typography>
        <TextField
          type="date"
          size="small"
          label="Date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            setTime('')
          }}
          error={Boolean(errors.date)}
          helperText={errors.date}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: dayString(0), max: dayString(30) } }}
        />
        <Box sx={{ mt: 1.5 }}>
          {duration === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Choose a service to see free times.
            </Typography>
          ) : slotsQuery.isPending ? (
            <Typography variant="body2" color="text.secondary">
              Checking free times…
            </Typography>
          ) : slotsQuery.isError ? (
            <Alert severity="error">{friendlyError(slotsQuery.error)}</Alert>
          ) : slots.length === 0 ? (
            <Alert severity="info">The salon is closed on this day. Please try another date.</Alert>
          ) : (
            <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }} role="group" aria-label="Available times">
              {slots.map((s) => (
                <Chip key={s.time} label={s.time} clickable={s.available} disabled={!s.available} color={time === s.time ? 'primary' : 'default'} variant={time === s.time ? 'filled' : 'outlined'} onClick={() => setTime(s.time)} />
              ))}
            </Stack>
          )}
          {errors.startTime && <FormHelperText error>{errors.startTime}</FormHelperText>}
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <Typography variant="subtitle2">3. Your details</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2, bgcolor: '#faf6f1', border: '1px solid #eadfd3' }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: '#c9a24a', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 }} aria-hidden>
            {customer.name.charAt(0)}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>Booking as {customer.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              +91 {customer.phone} · the salon will call you on this number
            </Typography>
          </Box>
        </Box>
        {mode === 'home' && (
          <TextField size="small" label="Your full address" multiline minRows={2} value={form.address} onChange={set('address')} onBlur={() => setErrors((cur) => ({ ...cur, address: addressProblem(form.address) || undefined }))} error={Boolean(errors.address)} helperText={errors.address} autoComplete="street-address" />
        )}
        <TextField size="small" label="Note for the salon (optional)" value={form.note} onChange={set('note')} />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', borderTop: 1, borderColor: 'divider', pt: 2 }}>
        <Box>
          {applied && (
            <Typography variant="caption" color="success.main" display="block">
              {formatMoney(subtotal)} − {formatMoney(applied.discount)} ({applied.offer.title})
            </Typography>
          )}
          <Typography sx={{ fontWeight: 800 }}>Total {formatMoney(total)}</Typography>
          <Typography variant="caption" color="text.secondary">
            {duration > 0 ? `${duration} min` : 'No service chosen'} · pay at the salon
          </Typography>
        </Box>
        <Button type="submit" variant="contained" disabled={saving}>
          {saving ? 'Booking…' : 'Confirm appointment'}
        </Button>
      </Box>
    </Box>
  )
}
