import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Alert, Box, Button, Chip, MenuItem, Paper, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { getBillingSummary, listInvoices } from '../api/billingApi'
import { useAuth } from '../auth/AuthContext'
import { roleCan } from '../auth/permissions'
import QueryState from '../components/QueryState'
import StatCard from '../components/StatCard'
import { formatPaise } from '../utils/formatMoney'
import ResponsiveTable from '../components/ResponsiveTable'

const PAGE_SIZE = 20

export const PAYMENT_CHIP = {
  paid: { label: 'Paid', color: 'success' },
  partial: { label: 'Partly paid', color: 'warning' },
  unpaid: { label: 'Pending', color: 'default' },
}

const dateOf = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

export function InvoiceStatusChip({ invoice }) {
  if (invoice.status === 'void') return <Chip size="small" color="error" variant="outlined" label="Void" />
  const c = PAYMENT_CHIP[invoice.paymentStatus]
  return <Chip size="small" color={c.color} label={c.label} />
}

// Billing dashboard: upar 4 total, neeche search + filters + bills ki list.
export default function BillingPage() {
  const { role, activeSalonId } = useAuth()
  const navigate = useNavigate()
  const canWrite = roleCan(role, 'billing.write')
  const [filters, setFilters] = useState({ search: '', from: '', to: '', method: '', paymentStatus: '' })
  const [page, setPage] = useState(1)
  const set = (name) => (e) => {
    setFilters((f) => ({ ...f, [name]: e.target.value }))
    setPage(1)
  }
  const range = { from: filters.from, to: filters.to }
  const rangeBad = filters.from && filters.to && filters.from > filters.to

  const summaryQuery = useQuery({
    queryKey: ['salon', activeSalonId, 'billing-summary', range],
    queryFn: () => getBillingSummary(range),
    enabled: !rangeBad,
    placeholderData: keepPreviousData,
  })
  const listQuery = useQuery({
    queryKey: ['salon', activeSalonId, 'invoices', filters, page],
    queryFn: () => listInvoices({ ...filters, page, pageSize: PAGE_SIZE }),
    enabled: !rangeBad,
    placeholderData: keepPreviousData,
  })
  const s = summaryQuery.data?.summary
  const rows = listQuery.data?.data.invoices ?? []
  const total = listQuery.data?.meta?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const filtered = Object.values(filters).some(Boolean)

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
          Create bills and keep track of payments.
        </Typography>
        {canWrite && (
          <Button variant="contained" onClick={() => navigate('/billing/new')}>
            Create new bill
          </Button>
        )}
      </Box>

      {summaryQuery.isError && <Alert severity="error" sx={{ mb: 2 }}>Could not load the billing totals.</Alert>}
      <section className="gl-stats" aria-label="Billing totals" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <StatCard icon="rupee" label="Total billed" value={s ? formatPaise(s.billed) : '—'} note={s ? `${s.invoices} invoices (incl. GST ${formatPaise(s.tax)})` : ''} />
        <StatCard icon="check" label="Amount received" value={s ? formatPaise(s.received) : '—'} note={s && s.refunded ? `after ${formatPaise(s.refunded)} refunds` : 'cash, UPI and card'} />
        <StatCard icon="clock" label="Pending payments" value={s ? formatPaise(s.pending) : '—'} note={s ? `${s.pendingCount} unpaid or partly paid` : ''} />
        <StatCard icon="card" label="Invoices" value={s ? String(s.invoices) : '—'} note="void bills not counted" />
      </section>

      {/* Saare filters ek hi line me (jagah kam ho to hi neeche aate hain) */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'flex-start', '& .MuiFormControl-root': { width: 'auto' } }}>
        <TextField size="small" label="Search invoice, name or mobile number" value={filters.search} onChange={set('search')} sx={{ flex: '1 1 260px', minWidth: 220 }} />
        <TextField size="small" type="date" label="From" value={filters.from} onChange={set('from')} slotProps={{ inputLabel: { shrink: true } }} error={Boolean(rangeBad)} sx={{ width: 140 }} />
        <TextField size="small" type="date" label="To" value={filters.to} onChange={set('to')} slotProps={{ inputLabel: { shrink: true } }} error={Boolean(rangeBad)} helperText={rangeBad ? 'To is before From.' : ''} sx={{ width: 140 }} />
      </Box>
      {/* Doosri line: method aur status */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center', '& .MuiFormControl-root': { width: 240, minWidth: 240, flexShrink: 0 } }}>
        <TextField select size="small" label="Payment method" value={filters.method} onChange={set('method')} sx={{ width: 240 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="cash">Cash</MenuItem>
          <MenuItem value="upi">UPI</MenuItem>
          <MenuItem value="card">Card</MenuItem>
        </TextField>
        <TextField select size="small" label="Payment status" value={filters.paymentStatus} onChange={set('paymentStatus')} sx={{ width: 240 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="paid">Paid</MenuItem>
          <MenuItem value="partial">Partly paid</MenuItem>
          <MenuItem value="unpaid">Pending</MenuItem>
        </TextField>
        {filtered && (
          <Button size="small" onClick={() => { setFilters({ search: '', from: '', to: '', method: '', paymentStatus: '' }); setPage(1) }}>Clear</Button>
        )}
      </Box>

      <QueryState
        query={listQuery}
        isEmpty={rows.length === 0}
        empty={<Alert severity="info">{filtered ? 'No invoices match these filters.' : `No invoices yet. ${canWrite ? 'Use "Create new bill" to make the first one.' : ''}`}</Alert>}
      >
        <TableContainer component={Paper}>
          <ResponsiveTable size="small" aria-label="Invoices">
            <TableHead>
              <TableRow>
                <TableCell>Invoice</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Due</TableCell>
                <TableCell>Status</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} hover sx={{ opacity: r.status === 'void' ? 0.6 : 1 }}>
                  <TableCell sx={{ fontWeight: 600 }}>{r.invoiceNumber}</TableCell>
                  <TableCell>
                    {r.customerName}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {r.customerPhone}
                    </Typography>
                  </TableCell>
                  <TableCell>{dateOf(r.createdAt)}</TableCell>
                  <TableCell align="right">{formatPaise(r.total)}</TableCell>
                  <TableCell align="right">{formatPaise(r.amountDue)}</TableCell>
                  <TableCell>
                    <InvoiceStatusChip invoice={r} />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => navigate(`/billing/${r.id}`)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </ResponsiveTable>
        </TableContainer>
        {pages > 1 && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'flex-end', mt: 1 }}>
            <Button size="small" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Typography variant="body2">
              Page {page} of {pages}
            </Typography>
            <Button size="small" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </Box>
        )}
      </QueryState>
    </Box>
  )
}
