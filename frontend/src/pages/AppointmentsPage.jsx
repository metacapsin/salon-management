import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, Chip, Link, Pagination, Paper, Tab, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, Typography } from '@mui/material'
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
const STATUS_COLOR = { pending: 'warning', confirmed: 'info', completed: 'success', cancelled: 'default' }
// Har status se kaun-kaun si agli action ho sakti hai
const ACTIONS = {
  pending: [{ to: 'confirmed', label: 'Confirm' }, { to: 'cancelled', label: 'Decline', color: 'error' }],
  confirmed: [{ to: 'completed', label: 'Mark done' }, { to: 'cancelled', label: 'Cancel', color: 'error' }],
  completed: [],
  cancelled: [],
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
    <Box sx={{ maxWidth: 1100 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800, color: 'primary.main' }}>
          Appointments
        </Typography>
        {canWrite && (
          <Button variant="contained" onClick={() => navigate('/appointments/new')}>
            New appointment
          </Button>
        )}
      </Box>
      {created && showCreated && (
        <Alert severity="success" onClose={() => setShowCreated(false)} sx={{ mb: 2 }}>
          Appointment saved for {created.name} on {formatDate(created.date)} at {created.time}. It is waiting for confirmation.
        </Alert>
      )}
      <Tabs value={status} onChange={(_, v) => changeStatus(v)} variant="scrollable" sx={{ mb: 2 }}>
        {FILTERS.map((f) => (
          <Tab key={f.value} value={f.value} label={f.label} />
        ))}
      </Tabs>
      {actionError && (
        <Alert severity="error" onClose={() => setActionError('')} sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      <QueryState query={query} isEmpty={bookings.length === 0} empty={<Alert severity="info">No appointments here yet. When a customer books from the Explore page, it will show up here.</Alert>}>
        <TableContainer component={Paper}>
          <ResponsiveTable size="small" aria-label="Appointments">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Services</TableCell>
                <TableCell>Staff</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Status</TableCell>
                {canWrite && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <strong>{formatDate(b.date)}</strong>
                    <br />
                    {b.startTime} · {b.durationMin} min
                  </TableCell>
                  <TableCell>
                    {b.customerName}
                    <br />
                    <Link href={`tel:${b.customerPhone}`} underline="hover">
                      {b.customerPhone}
                    </Link>
                    {b.mode === 'home' && (
                      <Typography variant="caption" display="block" color="text.secondary">
                        🏠 {b.address}
                      </Typography>
                    )}
                    {b.note && (
                      <Typography variant="caption" display="block" color="text.secondary">
                        Note: {b.note}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{b.services.map((s) => s.name).join(', ')}</TableCell>
                  <TableCell>{b.staffName || '-'}</TableCell>
                  <TableCell align="right">
                    {formatMoney(b.total)}
                    {b.membership && (
                      <Chip size="small" color="success" variant="outlined" label={`⭐ ${b.membership.planName}: −${formatMoney(b.membership.discount)}`} sx={{ mt: 0.5, display: 'flex' }} />
                    )}
                    {b.offer && (
                      <Chip size="small" color="warning" variant="outlined" label={`🏷️ ${b.offer.title}: −${formatMoney(b.offer.discount)}`} sx={{ mt: 0.5 }} />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={STATUS_COLOR[b.status]} label={b.status} sx={{ textTransform: 'capitalize' }} />
                  </TableCell>
                  {canWrite && (
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {canBenefits && b.status !== 'cancelled' && (
                        <Button size="small" onClick={() => setBenefitsFor(b)}>
                          Benefits
                        </Button>
                      )}
                      {ACTIONS[b.status].map((a) => (
                        <Button key={a.to} size="small" color={a.color ?? 'primary'} disabled={change.isPending} onClick={() => change.mutate({ id: b.id, to: a.to, booking: b })}>
                          {a.label}
                        </Button>
                      ))}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </ResponsiveTable>
        </TableContainer>
        {pageCount > 1 && <Pagination sx={{ mt: 2 }} count={pageCount} page={page} onChange={(_, p) => setPage(p)} />}
      </QueryState>
      {benefitsFor && <BenefitsDialog booking={benefitsFor} onClose={() => setBenefitsFor(null)} />}
    </Box>
  )
}
