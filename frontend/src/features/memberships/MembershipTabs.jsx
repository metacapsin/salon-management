import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, Chip, IconButton, MenuItem, Paper, Switch, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { friendlyError } from '../../api/client'
import { listCustomerMemberships, listMembershipPlans, updateMembershipPlan } from '../../api/membershipsApi'
import { listServices } from '../../api/salonApi'
import { useAuth } from '../../auth/AuthContext'
import QueryState from '../../components/QueryState'
import { formatMoney } from '../../utils/formatMoney'
import { discountText } from './AssignMembershipDialog'
import CustomerMembershipDialog from './CustomerMembershipDialog'
import MembershipPlanDialog from './MembershipPlanDialog'
import { MEMBERSHIP_STATUS } from './status'
import ResponsiveTable from '../../components/ResponsiveTable'
import EditIcon from '@mui/icons-material/EditOutlined'

const PAGE_SIZE = 20

// ---------- Plans: Silver / Gold jaise plan (sirf owner badal sakta hai) ----------
export function PlansTab({ canWrite, canSell, onAssign, notify }) {
  const { activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState(undefined) // undefined = band, null = naya, object = badalna
  const [actionError, setActionError] = useState('')

  const query = useQuery({
    queryKey: ['salon', activeSalonId, 'membership-plans', search, status],
    queryFn: () => listMembershipPlans({ search, status }),
    placeholderData: keepPreviousData,
  })
  const servicesQuery = useQuery({ queryKey: ['salon', activeSalonId, 'services'], queryFn: listServices })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['salon', activeSalonId] })
  const toggle = useMutation({
    mutationFn: ({ id, active }) => updateMembershipPlan(id, { active }),
    onSuccess: () => {
      setActionError('')
      refresh()
    },
    onError: (e) => setActionError(friendlyError(e)),
  })

  const plans = query.data?.plans ?? []
  const services = (servicesQuery.data?.services ?? []).filter((s) => s.active)
  const appliesTo = (p) => (p.serviceIds.length === 0 ? 'All services' : p.serviceIds.map((id) => services.find((s) => s.id === id)?.name ?? 'Removed service').join(', '))

  return (
    <>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" fullWidth={false} label="Search plans" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ width: 260 }} />
        <TextField select size="small" fullWidth={false} label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ width: 150 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Switched off</MenuItem>
        </TextField>
        <Box sx={{ flexGrow: 1 }} />
        {canWrite && (
          <Button variant="contained" onClick={() => setEditing(null)} disabled={servicesQuery.isPending}>
            Add plan
          </Button>
        )}
      </Box>
      {!canWrite && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You can see and sell membership plans. Only the owner can create or change them.
        </Alert>
      )}
      {actionError && (
        <Alert severity="error" onClose={() => setActionError('')} sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}
      <QueryState
        query={query}
        isEmpty={plans.length === 0}
        empty={<Alert severity="info">{search || status ? 'No plans match this search.' : `No membership plans yet. ${canWrite ? 'Add your first plan, like Silver or Gold.' : ''}`}</Alert>}
      >
        <TableContainer component={Paper}>
          <ResponsiveTable size="small" aria-label="Membership plans">
            <TableHead>
              <TableRow>
                <TableCell>Plan</TableCell>
                <TableCell>Discount</TableCell>
                <TableCell>Applies to</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell>Valid</TableCell>
                <TableCell>Status</TableCell>
                {canWrite && <TableCell>On</TableCell>}
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id} sx={{ opacity: p.active ? 1 : 0.55 }}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600 }}>{p.name}</Typography>
                    {(p.description || p.benefits.length > 0) && (
                      <Typography variant="caption" color="text.secondary">
                        {[p.description, ...p.benefits].filter(Boolean).join(' · ')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{discountText(p)}</TableCell>
                  <TableCell>{appliesTo(p)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {formatMoney(p.price)}
                  </TableCell>
                  <TableCell>{p.durationDays} days</TableCell>
                  <TableCell>
                    <Chip size="small" color={p.active ? 'success' : 'default'} label={p.active ? 'Active' : 'Off'} />
                  </TableCell>
                  {canWrite && (
                    <TableCell>
                      <Switch checked={p.active} disabled={toggle.isPending} onChange={(e) => toggle.mutate({ id: p.id, active: e.target.checked })} slotProps={{ input: { 'aria-label': `${p.name} on` } }} />
                    </TableCell>
                  )}
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {canSell && p.active && (
                      <Button size="small" onClick={() => onAssign(p.id)}>
                        Assign
                      </Button>
                    )}
                    {canWrite && (
                      <IconButton size="small" aria-label="Edit" title="Edit" sx={{ minWidth: 36, minHeight: 36 }} onClick={() => setEditing(p)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </ResponsiveTable>
        </TableContainer>
      </QueryState>
      {editing !== undefined && (
        <MembershipPlanDialog
          plan={editing}
          services={services}
          onClose={() => setEditing(undefined)}
          onSaved={(message) => {
            setEditing(undefined)
            notify(message)
            refresh()
          }}
        />
      )}
    </>
  )
}

// ---------- Members: customers ke memberships ----------
export function MembersTab({ canSell }) {
  const { activeSalonId } = useAuth()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState(null)

  const query = useQuery({
    queryKey: ['salon', activeSalonId, 'customer-memberships', search, status, paymentStatus, page],
    queryFn: () => listCustomerMemberships({ search, status, paymentStatus, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
  const rows = query.data?.data.customerMemberships ?? []
  const total = query.data?.meta?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const reset = (set) => (e) => {
    set(e.target.value)
    setPage(1)
  }

  return (
    <>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField size="small" fullWidth={false} label="Search customer, phone or plan" value={search} onChange={reset(setSearch)} sx={{ width: { xs: '100%', sm: 320 } }} />
        <TextField select size="small" fullWidth={false} label="Status" value={status} onChange={reset(setStatus)} sx={{ width: 150 }}>
          <MenuItem value="">All</MenuItem>
          {Object.entries(MEMBERSHIP_STATUS).map(([value, c]) => (
            <MenuItem key={value} value={value}>
              {c.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" fullWidth={false} label="Payment" value={paymentStatus} onChange={reset(setPaymentStatus)} sx={{ width: 150 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="paid">Paid</MenuItem>
          <MenuItem value="pending">Pending</MenuItem>
        </TextField>
      </Box>
      <QueryState
        query={query}
        isEmpty={rows.length === 0}
        empty={<Alert severity="info">{search || status || paymentStatus ? 'Nothing matches this search.' : `No membership has been sold yet. ${canSell ? 'Use "Assign" on a plan to sell one.' : ''}`}</Alert>}
      >
        <TableContainer component={Paper}>
          <ResponsiveTable size="small" aria-label="Members">
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Starts</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell>Payment</TableCell>
                <TableCell>Status</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600 }}>{r.customerName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.customerPhone}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {r.planName}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {discountText(r)}
                    </Typography>
                  </TableCell>
                  <TableCell>{r.startsOn}</TableCell>
                  <TableCell>{r.expiresOn}</TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" color={r.paymentStatus === 'paid' ? 'success' : 'warning'} label={r.paymentStatus === 'paid' ? 'Paid' : 'Pending'} />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={MEMBERSHIP_STATUS[r.status].color} label={MEMBERSHIP_STATUS[r.status].label} />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => setOpenId(r.id)}>
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
      {openId && <CustomerMembershipDialog id={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
