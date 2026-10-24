import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { createInvoice, listBillableAppointments, previewInvoice } from '../api/billingApi'
import { friendlyError } from '../api/client'
import { NAME_ERROR, NAME_PATTERN } from '../utils/validators'
import { getBookingBenefits, listCustomers, listOffers, listServices } from '../api/salonApi'
import { useAuth } from '../auth/AuthContext'
import { formatMoney, formatPaise } from '../utils/formatMoney'

const PHONE_OK = /^\d{10}$/
const today = () => new Date().toLocaleDateString('en-CA')
const newKey = () => `bill-${crypto.randomUUID()}`

// Naya bill. Screen sirf "kaun, kya, kitna" chuntI hai; total, discount aur GST server ke /invoices/preview se aate hain,
// aur "Create bill" dabane par wahi hisaab server dobara karke bill banata hai.
export default function CreateBillPage() {
  const { activeSalonId } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [bookingId, setBookingId] = useState('')
  const [lines, setLines] = useState([]) // [{ serviceId, name, quantity }]
  const [offerId, setOfferId] = useState('')
  const [applyMembership, setApplyMembership] = useState(true)
  const [redeem, setRedeem] = useState({}) // 'cpId:serviceId' -> { customerPackageId, serviceId }
  const [submitError, setSubmitError] = useState('')

  const phoneValid = PHONE_OK.test(phone)
  const nameValid = NAME_PATTERN.test(name.trim()) // linked appointment ka naam bhi isi se guzarta hai
  const key = ['salon', activeSalonId]

  const customersQuery = useQuery({
    queryKey: [...key, 'customers', 'pick', search],
    queryFn: () => listCustomers({ page: 1, search }),
    enabled: search.length >= 2,
  })
  const servicesQuery = useQuery({ queryKey: [...key, 'services'], queryFn: listServices })
  const offersQuery = useQuery({ queryKey: [...key, 'offers'], queryFn: listOffers })
  const apptQuery = useQuery({ queryKey: [...key, 'billable', phone], queryFn: () => listBillableAppointments(phone), enabled: phoneValid })
  const appointments = phoneValid ? (apptQuery.data?.appointments ?? []) : []
  const booking = appointments.find((a) => a.id === bookingId) ?? null
  const benefitsQuery = useQuery({
    queryKey: [...key, 'benefits', bookingId],
    queryFn: () => getBookingBenefits(bookingId),
    enabled: Boolean(booking) && booking.status === 'completed',
  })

  const services = (servicesQuery.data?.services ?? []).filter((s) => s.active)
  const offers = (offersQuery.data?.offers ?? []).filter((o) => o.active && o.startsOn <= today() && o.endsOn >= today())
  const packages = booking?.status === 'completed' ? (benefitsQuery.data?.packages ?? []) : []

  // Server ko bhejne wali body. Sirf IDs aur quantity; koi price/total nahi.
  const body = useMemo(() => {
    const b = { applyMembership, lines: lines.map((l) => ({ serviceId: l.serviceId, quantity: l.quantity })) }
    if (bookingId) b.bookingId = bookingId
    else {
      b.customerPhone = phone
      b.customerName = name.trim()
    }
    if (offerId) b.offerId = offerId
    const picks = Object.values(redeem)
    if (bookingId && picks.length) b.packageRedemptions = picks
    return b
  }, [applyMembership, lines, bookingId, phone, name, offerId, redeem])

  const ready = lines.length > 0 && (bookingId || (phoneValid && nameValid))
  const quote = useQuery({
    queryKey: [...key, 'bill-preview', body],
    queryFn: () => previewInvoice(body),
    enabled: Boolean(ready),
    retry: false,
  })

  // Wahi body = wahi requestKey (double click par ek hi bill). Body badle to naya key.
  const requestKey = useMemo(() => newKey(), [body]) // eslint-disable-line react-hooks/exhaustive-deps
  const create = useMutation({
    mutationFn: () => createInvoice({ ...body, requestKey }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: key })
      navigate(`/billing/${data.invoice.id}`, { replace: true })
    },
    onError: (e) => setSubmitError(friendlyError(e)),
  })

  function pickCustomer(c) {
    if (!c) return
    setPhone(c.phone)
    setName(c.name)
    setBookingId('')
    setLines([])
    setRedeem({})
  }
  function pickAppointment(id) {
    setBookingId(id)
    setRedeem({})
    const a = appointments.find((x) => x.id === id)
    if (a) {
      setName(a.customerName)
      setLines(a.services.map((s) => ({ serviceId: String(s.serviceId), name: s.name, quantity: 1 })))
    }
  }
  const setQty = (serviceId, quantity) => setLines((ls) => ls.map((l) => (l.serviceId === serviceId ? { ...l, quantity: Math.min(20, Math.max(1, quantity || 1)) } : l)))
  const addService = (s) => {
    if (s && !lines.some((l) => l.serviceId === s.id)) setLines((ls) => [...ls, { serviceId: s.id, name: s.name, quantity: 1 }])
  }
  const toggleRedeem = (cpId, serviceId, on) =>
    setRedeem((r) => {
      const next = { ...r }
      const k = `${cpId}:${serviceId}`
      if (on) {
        for (const other of Object.keys(next)) if (other.endsWith(`:${serviceId}`)) delete next[other] // ek service ke liye ek hi package
        next[k] = { customerPackageId: cpId, serviceId }
      } else delete next[k]
      return next
    })

  const q = quote.data
  const quoteError = quote.isError ? friendlyError(quote.error) : ''

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800, color: 'primary.main', flexGrow: 1 }}>
          Create new bill
        </Typography>
        <Button onClick={() => navigate('/billing')}>Cancel</Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>1. Customer</Typography>
        {/* Customer ke saare input ek hi line me (jagah kam ho to hi neeche aate hain) */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Autocomplete
          options={customersQuery.data?.data.customers ?? []}
          loading={customersQuery.isFetching}
          getOptionLabel={(c) => `${c.name} (${c.phone})`}
          filterOptions={(x) => x}
          onInputChange={(_, v, reason) => reason === 'input' && setSearch(v)}
          onChange={(_, c) => pickCustomer(c)}
          noOptionsText={search.length < 2 ? 'Type a name or mobile number' : 'No customer found. Enter the details below.'}
          renderInput={(params) => <TextField {...params} size="small" label="Find an existing customer" />}
          sx={{ width: 230, flexShrink: 0 }}
        />
          <TextField
            size="small"
            label="Mobile number"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
              setBookingId('')
              setRedeem({})
            }}
            error={Boolean(phone) && !phoneValid}
            helperText={phone && !phoneValid ? 'Enter a 10 digit mobile number.' : ''}
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            sx={{ width: 140, flexShrink: 0 }}
          />
          <TextField size="small" label="Customer name" value={name} onChange={(e) => setName(e.target.value)} disabled={Boolean(bookingId)} error={Boolean(name.trim()) && !nameValid} helperText={name.trim() && !nameValid ? NAME_ERROR : ''} slotProps={{ htmlInput: { maxLength: 100 } }} sx={{ width: 170, flexShrink: 0 }} />
          <TextField select size="small" label="Link an appointment (optional)" value={bookingId} onChange={(e) => pickAppointment(e.target.value)} disabled={!phoneValid} sx={{ width: 250, flexShrink: 0 }}>
            <MenuItem value="">No appointment (walk-in)</MenuItem>
            {appointments.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.date} {a.startTime} · {a.services.map((s) => s.name).join(', ')} · {a.status}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>2. Services</Typography>
        <Autocomplete
          key={lines.length}
          options={services.filter((s) => !lines.some((l) => l.serviceId === s.id))}
          getOptionLabel={(s) => `${s.name} — ${formatMoney(s.price)}`}
          onChange={(_, s) => addService(s)}
          renderInput={(params) => <TextField {...params} size="small" label="Add a service" />}
          sx={{ mb: 2, width: { xs: '100%', sm: 300 } }}
        />
        {lines.length === 0 ? (
          <Alert severity="info">Add at least one service{phoneValid ? ', or link an appointment to load its services' : ''}.</Alert>
        ) : (
          <Table size="small" aria-label="Bill services">
            <TableHead>
              <TableRow>
                <TableCell>Service</TableCell>
                <TableCell>Qty</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.serviceId}>
                  <TableCell>{l.name}</TableCell>
                  <TableCell>
                    <TextField type="number" size="small" value={l.quantity} onChange={(e) => setQty(l.serviceId, Number(e.target.value))} slotProps={{ htmlInput: { min: 1, max: 20, 'aria-label': `${l.name} quantity` } }} sx={{ width: 70 }} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" aria-label={`Remove ${l.name}`} onClick={() => setLines((ls) => ls.filter((x) => x.serviceId !== l.serviceId))}>
                      ✕
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>3. Discounts and packages</Typography>
        <TextField select size="small" label="Offer" value={offerId} onChange={(e) => setOfferId(e.target.value)} sx={{ width: 260, mb: 1 }}>
          <MenuItem value="">No offer</MenuItem>
          {offers.map((o) => (
            <MenuItem key={o.id} value={o.id}>
              {o.title} ({o.discountType === 'percent' ? `${o.discountValue}%` : formatMoney(o.discountValue)} off)
            </MenuItem>
          ))}
        </TextField>
        <Box>
          <FormControlLabel control={<Checkbox checked={applyMembership} onChange={(e) => setApplyMembership(e.target.checked)} />} label="Apply the customer's membership discount if they have one" />
        </Box>
        {booking && booking.status !== 'completed' && <Alert severity="info" sx={{ mt: 1 }}>Package sessions can be used only after the appointment is marked completed.</Alert>}
        {packages.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2">Package sessions</Typography>
            {packages.flatMap((p) =>
              p.services.map((s) => (
                <FormControlLabel
                  key={`${p.customerPackageId}:${s.serviceId}`}
                  sx={{ display: 'block' }}
                  disabled={s.redeemed}
                  control={<Checkbox checked={s.redeemed || Boolean(redeem[`${p.customerPackageId}:${s.serviceId}`])} onChange={(e) => toggleRedeem(p.customerPackageId, s.serviceId, e.target.checked)} />}
                  label={s.redeemed ? `${s.serviceName}: session already used from ${p.packageName} (not charged)` : `Use 1 session of ${p.packageName} for ${s.serviceName} (${s.remaining} left)`}
                />
              )),
            )}
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>4. Bill total</Typography>
        {!ready && <Alert severity="info">Choose the customer and add services to see the total.</Alert>}
        {quoteError && <Alert severity="error">{quoteError}</Alert>}
        {ready && quote.isPending && <Typography color="text.secondary">Calculating…</Typography>}
        {q && !quoteError && (
          <>
            <Table size="small" aria-label="Bill total">
              <TableHead>
                <TableRow>
                  <TableCell>Service</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {q.lines.map((l) => (
                  <TableRow key={l.serviceId}>
                    <TableCell>
                      {l.name}
                      {l.coveredUnits > 0 && (
                        <Typography variant="caption" color="success.main" sx={{ display: 'block' }}>
                          1 covered by {l.packageName}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{formatPaise(l.unitPrice)}</TableCell>
                    <TableCell align="right">{l.quantity}</TableCell>
                    <TableCell align="right">{formatPaise(l.lineTotal)}</TableCell>
                  </TableRow>
                ))}
                <Row label="Subtotal" value={q.subtotal} />
                {q.offer && <Row label={`Offer: ${q.offer.title}`} value={-q.offer.discount} />}
                {q.membership && <Row label={`Membership: ${q.membership.planName}`} value={-q.membership.discount} />}
                <Row label="Amount before tax" value={q.taxableAmount} />
                <Row label={`CGST ${q.tax.ratePercent / 2}%`} value={q.tax.cgst} />
                <Row label={`SGST ${q.tax.ratePercent / 2}%`} value={q.tax.sgst} />
                <Row label="Total" value={q.total} bold />
              </TableBody>
            </Table>
            {submitError && <Alert severity="error" sx={{ mt: 2 }}>{submitError}</Alert>}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button variant="contained" size="large" disabled={create.isPending} onClick={() => { setSubmitError(''); create.mutate() }}>
                {create.isPending ? 'Creating…' : 'Create bill'}
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  )
}

function Row({ label, value, bold }) {
  const sx = bold ? { fontWeight: 800, fontSize: '1.05rem' } : undefined
  return (
    <TableRow>
      <TableCell colSpan={3} align="right" sx={sx}>
        {label}
      </TableCell>
      <TableCell align="right" sx={sx}>
        {value < 0 ? `− ${formatPaise(-value)}` : formatPaise(value)}
      </TableCell>
    </TableRow>
  )
}
