import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Alert, Box, Chip, Link, Pagination, Paper, Tab, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material'
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
const SEGMENT_COLOR = { new: 'info', regular: 'success', inactive: 'default' }

const formatDate = (date) => (date ? new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

function StatCard({ label, value }) {
  return (
    <Paper sx={{ p: 2, flex: '1 1 160px' }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 800 }}>
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
    <Box sx={{ maxWidth: 1100 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800, color: 'primary.main', mb: 2 }}>
        Customers
      </Typography>

      {summary && (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <StatCard label="Total customers" value={summary.total} />
          <StatCard label="New this month" value={summary.newThisMonth} />
          <StatCard label="Regular (2+ visits)" value={summary.regular} />
          <StatCard label="Inactive" value={summary.inactive} />
        </Box>
      )}

      <TextField
        size="small"
        label="Search by name or mobile"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        sx={{ mb: 2, width: { xs: '100%', sm: 320 } }}
      />
      <Tabs
        value={segment}
        onChange={(_, v) => {
          setSegment(v)
          setPage(1)
        }}
        variant="scrollable"
        sx={{ mb: 2 }}
      >
        {FILTERS.map((f) => (
          <Tab key={f.value} value={f.value} label={f.label} />
        ))}
      </Tabs>

      <QueryState
        query={query}
        isEmpty={customers.length === 0}
        empty={<Alert severity="info">No customers found. Customers appear here after they book an appointment.</Alert>}
      >
        <TableContainer component={Paper}>
          <ResponsiveTable size="small" aria-label="Customers">
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
                    <strong>{c.name}</strong>
                  </TableCell>
                  <TableCell>
                    <Link href={`tel:${c.phone}`} underline="hover">
                      {c.phone}
                    </Link>
                  </TableCell>
                  <TableCell align="right">{c.visits}</TableCell>
                  <TableCell>{formatDate(c.lastVisit)}</TableCell>
                  <TableCell align="right">{formatMoney(c.spent)}</TableCell>
                  <TableCell>
                    <Chip size="small" color={SEGMENT_COLOR[c.segment]} label={c.segment} sx={{ textTransform: 'capitalize' }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </ResponsiveTable>
        </TableContainer>
        {pageCount > 1 && <Pagination count={pageCount} page={page} onChange={(_, p) => setPage(p)} sx={{ mt: 2 }} />}
      </QueryState>
    </Box>
  )
}
