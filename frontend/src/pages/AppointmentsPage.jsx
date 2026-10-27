import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Avatar, Box, Button, Chip, Link, Pagination, Paper, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import PhoneIcon from '@mui/icons-material/PhoneOutlined'
import { friendlyError } from '../api/client'
import { getBookingBenefits, listBookings, setBookingStatus } from '../api/salonApi'
import { useAuth } from '../auth/AuthContext'
import { roleCan } from '../auth/permissions'
import QueryState from '../components/QueryState'
import BenefitsDialog from '../features/appointments/BenefitsDialog'
import { benefitsKey } from '../features/appointments/benefitsKey'
import { formatMoney } from '../utils/formatMoney'
import ResponsiveTable from '../components/ResponsiveTable'

// Pending (New requests) sabse pehle, taaki owner ko jo kaam baki hai wo pehle dikhe
const FILTERS = [
  { value: 'pending', label: 'New requests' },
  { value: '', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]
// Status ke halke (soft) rang: background, text aur chhota dot
const STATUS_STYLE = {
  pending: { bg: '#fff4dc', fg: '#8a5a00', dot: '#e0a100' },
  confirmed: { bg: '#e3f0fb', fg: '#0b5394', dot: '#2f8fde' },
  completed: { bg: '#e2f2e5', fg: '#25602f', dot: '#2f6b3a' },
  cancelled: { bg: '#f1ebe6', fg: '#7a6150', dot: '#a8978a' },
}
// Har status se kaun-kaun si agli action ho sakti hai
const ACTIONS = {
  pending: [{ to: 'confirmed', label: 'Confirm' }, { to: 'cancelled', label: 'Decline', color: 'error' }],
  confirmed: [{ to: 'completed', label: 'Mark done' }, { to: 'cancelled', label: 'Cancel', color: 'error' }],
  completed: [],
  cancelled: [],
}

const dateParts = (date) => {
  const d = new Date(`${date}T00:00:00`)
  return { day: d.getDate(), month: d.toLocaleDateString('en-IN', { month: 'short' }), weekday: d.toLocaleDateString('en-IN', { weekday: 'long' }) }
}
const formatDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

// Customers ki aayi hui appointments. Owner, manager aur receptionist confirm ya cancel kar sakte hain.
export default function AppointmentsPage() {
  const { role, activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const canWrite = roleCan(role, 'appointments.write')
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const [actionError, setActionError] = useState('')
  const navigate = useNavigate()
  const created = useLocation().state?.created // naya appointment banane ke baad yahan aate hain
  const [showCreated, setShowCreated] = useState(true)
  const [benefitsFor, setBenefitsFor] = useState(null) // jis appointment ke benefits dikha rahe hain
  const canBenefits = roleCan(role, 'packages.sell') || roleCan(role, 'memberships.sell')

  const query = useQuery({
    queryKey: ['salon', activeSalonId, 'bookings', status, page],
    queryFn: () => listBookings(page, status),
    placeholderData: keepPreviousData,
  })
  const change = useMutation({
    mutationFn: ({ id, to }) => setBookingStatus(id, to),
    onSuccess: async (_, { to, booking }) => {
      setActionError('')
      queryClient.invalidateQueries({ queryKey: ['salon', activeSalonId] })
      // "Done" karte hi, agar customer ke paas lagne layak package/membership hai to turant dikhao
      if (to === 'completed' && canBenefits) {
        try {
          const found = await queryClient.fetchQuery({ queryKey: benefitsKey(activeSalonId, booking.id), queryFn: () => getBookingBenefits(booking.id), staleTime: 0 })
          if (found.packages.length > 0 || found.membership) setBenefitsFor(booking)
        } catch {
          // dikhe na dikhe, appointment done ho chuka hai; "Benefits" button se baad me dekh sakte hain
        }
      }
    },
    onError: (error) => setActionError(friendlyError(error)),
  })

  function changeStatus(value) {
    setStatus(value)
    setPage(1)
  }

  const bookings = query.data?.data.bookings ?? []
  const pageCount = Math.max(1, Math.ceil((query.data?.meta?.total ?? 0) / 20))

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary">
          Confirm, complete or cancel bookings from your customers.
        </Typography>
        {canWrite && (
          <Button variant="contained" size="small" startIcon={<AddIcon />} sx={{ minHeight: 40 }} onClick={() => navigate('/appointments/new')}>
            New appointment
          </Button>
        )}
      </Box>
      {created && showCreated && (
        <Alert severity="success" onClose={() => setShowCreated(false)} sx={{ mb: 2 }}>
          Appointment saved for {created.name} on {formatDate(created.date)} at {created.time}. It is waiting for confirmation.
        </Alert>
      )}
      <Box role="tablist" aria-label="Filter appointments" sx={{ display: 'flex', gap: 0.75, mb: 1.5, overflowX: 'auto', pb: 0.25 }}>
        {FILTERS.map((f) => {
          const active = status === f.value
          return (
            <Chip
              key={f.value}
              role="tab"
              aria-selected={active}
              label={f.label}
              clickable
              onClick={() => changeStatus(f.value)}
              color={active ? 'primary' : 'default'}
              variant={active ? 'filled' : 'outlined'}
              sx={{ height: 32, fontSize: '0.8125rem', bgcolor: active ? undefined : '#fff', borderColor: active ? 'primary.main' : 'divider', flexShrink: 0 }}
            />
          )
        })}
      </Box>
      {actionError && (
        <Alert severity="error" onClose={() => setActionError('')} sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      <QueryState query={query} isEmpty={bookings.length === 0} empty={<Alert severity="info">No appointments here yet. When a customer books from the Explore page, it will show up here.</Alert>}>
        <TableContainer component={Paper}>
          <ResponsiveTable
            size="medium"
            aria-label="Appointments"
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 150 }}>When</TableCell>
                <TableCell sx={{ width: 200 }}>Customer</TableCell>
                <TableCell>Services</TableCell>
                <TableCell sx={{ width: 90 }}>Staff</TableCell>
                <TableCell align="right" sx={{ width: 140 }}>Total</TableCell>
                <TableCell sx={{ width: 120 }}>Status</TableCell>
                {canWrite && <TableCell align="right" sx={{ width: { xs: 150, lg: 250 } }}>Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {bookings.map((b) => {
                const d = dateParts(b.date)
                const st = STATUS_STYLE[b.status]
                return (
                <TableRow key={b.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, textAlign: 'left' }}>
                      <Box sx={{ width: 38, height: 40, flex: 'none', borderRadius: '10px', background: 'linear-gradient(180deg,#f3e7c9,#fbf3de)', border: '1px solid #ead9a8', display: 'grid', placeItems: 'center', textAlign: 'center', lineHeight: 1.1 }}>
                        <Box>
                          <Typography component="span" sx={{ display: 'block', fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a6a1f' }}>
                            {d.month}
                          </Typography>
                          <Typography component="span" sx={{ display: 'block', fontSize: '1rem', fontWeight: 800, color: 'text.primary' }}>
                            {d.day}
                          </Typography>
                        </Box>
                      </Box>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {d.weekday}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {b.startTime} · {b.durationMin} min
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, textAlign: 'left' }}>
                      <Avatar sx={{ width: 32, height: 32, flex: 'none', bgcolor: 'primary.main', fontSize: '0.85rem', fontWeight: 700 }}>{b.customerName.trim().charAt(0).toUpperCase()}</Avatar>
                      <Box sx={{ minWidth: 0, maxWidth: { md: 150 } }}>
                        <Typography variant="body2" noWrap sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
                          {b.customerName}
                        </Typography>
                        <Link href={`tel:${b.customerPhone}`} underline="hover" variant="caption" color="text.secondary" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                          <PhoneIcon sx={{ fontSize: 13 }} />
                          {b.customerPhone}
                        </Link>
                        {b.mode === 'home' && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            🏠 {b.address}
                          </Typography>
                        )}
                        {b.note && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Note: {b.note}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: { xs: 'flex-end', md: 'flex-start' } }}>
                      {b.services.map((s, i) => (
                        <Chip key={`${s.name}-${i}`} size="small" label={s.name} sx={{ height: 22, bgcolor: '#f6efe7', color: 'text.primary', fontWeight: 600, fontSize: '0.72rem' }} />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color={b.staffName ? 'text.primary' : 'text.disabled'}>
                      {b.staffName || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {formatMoney(b.total)}
                      </Typography>
                      {b.membership && (
                        <Chip size="small" color="success" variant="outlined" label={`⭐ ${b.membership.planName}: −${formatMoney(b.membership.discount)}`} sx={{ maxWidth: '100%', fontSize: '0.7rem' }} />
                      )}
                      {b.offer && (
                        <Chip size="small" color="warning" variant="outlined" label={`🏷️ ${b.offer.title}: −${formatMoney(b.offer.discount)}`} sx={{ maxWidth: '100%', fontSize: '0.7rem' }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.1, py: 0.35, borderRadius: 99, bgcolor: st.bg, color: st.fg, fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize' }}>
                      <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: st.dot }} />
                      {b.status}
                    </Box>
                  </TableCell>
                  {canWrite && (
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', lg: 'nowrap' }, justifyContent: 'flex-end', alignItems: 'center', gap: 0.75, whiteSpace: 'nowrap' }}>
                        {canBenefits && b.status !== 'cancelled' && (
                          <Button size="small" variant="outlined" color="inherit" sx={{ minHeight: 32, borderColor: 'divider', color: 'text.secondary' }} onClick={() => setBenefitsFor(b)}>
                            Benefits
                          </Button>
                        )}
                        {ACTIONS[b.status].map((a) => (
                          <Button key={a.to} size="small" variant={a.color ? 'text' : 'contained'} color={a.color ?? 'primary'} disabled={change.isPending} sx={{ minHeight: 32 }} onClick={() => change.mutate({ id: b.id, to: a.to, booking: b })}>
                            {a.label}
                          </Button>
                        ))}
                      </Box>
                    </TableCell>
                  )}
                </TableRow>
                )
              })}
            </TableBody>
          </ResponsiveTable>
        </TableContainer>
        {pageCount > 1 && <Pagination sx={{ mt: 1.5 }} count={pageCount} page={page} onChange={(_, p) => setPage(p)} />}
      </QueryState>
      {benefitsFor && <BenefitsDialog booking={benefitsFor} onClose={() => setBenefitsFor(null)} />}
    </Box>
  )
}
