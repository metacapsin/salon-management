import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Alert, Avatar, Box, Chip, InputAdornment, Link, Pagination, Paper, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import PhoneIcon from '@mui/icons-material/PhoneOutlined'
import { listCustomers } from '../api/salonApi'
import { useAuth } from '../auth/AuthContext'
import QueryState from '../components/QueryState'
import { formatMoney } from '../utils/formatMoney'
import ResponsiveTable from '../components/ResponsiveTable'

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'regular', label: 'Regular' },
  { value: 'inactive', label: 'Inactive (30+ days)' },
]
// Customer type ke halke (soft) rang: background, text aur chhota dot
const SEGMENT_STYLE = {
  new: { bg: '#e3f0fb', fg: '#0b5394', dot: '#2f8fde' },
  regular: { bg: '#e2f2e5', fg: '#25602f', dot: '#2f6b3a' },
  inactive: { bg: '#f1ebe6', fg: '#7a6150', dot: '#a8978a' },
}

const formatDate = (date) => (date ? new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

function StatCard({ label, value }) {
  return (
    <Paper sx={{ px: 2, py: 1.5, flex: '1 1 150px', borderRadius: '12px', border: '1px solid', borderColor: 'divider', borderLeft: '4px solid #c9a24a', boxShadow: '0 1px 2px rgba(58,36,21,0.04)' }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
        {value}
      </Typography>
    </Paper>
  )
}

// Salon ke customers: bookings se bani list. Search naam ya mobile se, filter segment se.
export default function CustomersPage() {
  const { activeSalonId } = useAuth()
  const [segment, setSegment] = useState('')
  const [page, setPage] = useState(1)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')

  // Har key dabane par server ko na bulaye: 400ms ruk kar search karte hain
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(input.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [input])

  const query = useQuery({
    queryKey: ['salon', activeSalonId, 'customers', segment, search, page],
    queryFn: () => listCustomers({ page, search, segment }),
    placeholderData: keepPreviousData,
  })

  const customers = query.data?.data.customers ?? []
  const summary = query.data?.data.summary
  const pageCount = Math.max(1, Math.ceil((query.data?.meta?.total ?? 0) / 20))

  return (
    <Box>
      {summary && (
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
          <StatCard label="Total customers" value={summary.total} />
          <StatCard label="New this month" value={summary.newThisMonth} />
          <StatCard label="Regular (2+ visits)" value={summary.regular} />
          <StatCard label="Inactive" value={summary.inactive} />
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
        <TextField
          size="small"
          placeholder="Search by name or mobile"
          aria-label="Search by name or mobile"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          sx={{ width: { xs: '100%', sm: 300 } }}
        />
        <Box role="tablist" aria-label="Filter customers" sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', maxWidth: '100%' }}>
          {FILTERS.map((f) => {
            const active = segment === f.value
            return (
              <Chip
                key={f.value}
                role="tab"
                aria-selected={active}
                label={f.label}
                clickable
                onClick={() => {
                  setSegment(f.value)
                  setPage(1)
                }}
                color={active ? 'primary' : 'default'}
                variant={active ? 'filled' : 'outlined'}
                sx={{ height: 32, fontSize: '0.8125rem', bgcolor: active ? undefined : '#fff', borderColor: active ? 'primary.main' : 'divider', flexShrink: 0 }}
              />
            )
          })}
        </Box>
      </Box>

      <QueryState
        query={query}
        isEmpty={customers.length === 0}
        empty={<Alert severity="info">No customers found. Customers appear here after they book an appointment.</Alert>}
      >
        <TableContainer component={Paper}>
          <ResponsiveTable
            size="small"
            aria-label="Customers"
          >
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell>Mobile</TableCell>
                <TableCell align="right">Visits</TableCell>
                <TableCell>Last visit</TableCell>
                <TableCell align="right">Total spent</TableCell>
                <TableCell>Type</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.phone}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, textAlign: 'left' }}>
                      <Avatar sx={{ width: 32, height: 32, flex: 'none', bgcolor: 'primary.main', fontSize: '0.85rem', fontWeight: 700 }}>{c.name.trim().charAt(0).toUpperCase()}</Avatar>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 700, textTransform: 'capitalize', maxWidth: { md: 220 } }}>
                        {c.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Link href={`tel:${c.phone}`} underline="hover" variant="body2" color="text.secondary" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                      <PhoneIcon sx={{ fontSize: 14 }} />
                      {c.phone}
                    </Link>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{c.visits}</TableCell>
                  <TableCell>{formatDate(c.lastVisit)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{formatMoney(c.spent)}</TableCell>
                  <TableCell>
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.1, py: 0.35, borderRadius: 99, bgcolor: SEGMENT_STYLE[c.segment].bg, color: SEGMENT_STYLE[c.segment].fg, fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize' }}>
                      <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: SEGMENT_STYLE[c.segment].dot }} />
                      {c.segment}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </ResponsiveTable>
        </TableContainer>
        {pageCount > 1 && <Pagination count={pageCount} page={page} onChange={(_, p) => setPage(p)} sx={{ mt: 1.5 }} />}
      </QueryState>
    </Box>
  )
}
