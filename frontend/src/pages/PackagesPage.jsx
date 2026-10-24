import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Snackbar,
  Switch,
  Tab,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { friendlyError } from '../api/client'
import { listCustomerPackages, listPackages, updatePackage } from '../api/packagesApi'
import { listMembershipPlans } from '../api/membershipsApi'
import { listServices } from '../api/salonApi'
import { useAuth } from '../auth/AuthContext'
import { roleCan } from '../auth/permissions'
import QueryState from '../components/QueryState'
import AssignPackageDialog from '../features/packages/AssignPackageDialog'
import CustomerPackageDialog, { STATUS_CHIP } from '../features/packages/CustomerPackageDialog'
import AssignMembershipDialog from '../features/memberships/AssignMembershipDialog'
import { MembersTab, PlansTab } from '../features/memberships/MembershipTabs'
import PackageDialog from '../features/packages/PackageDialog'
import { formatMoney } from '../utils/formatMoney'
import ResponsiveTable from '../components/ResponsiveTable'

const PAGE_SIZE = 20

// ---------- Tab 1: salon ke packages (template) ----------
function PackagesTab({ canWrite, canSell, onAssign, notify }) {
  const { activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState(undefined) // undefined = band, null = naya, object = badalna
  const [actionError, setActionError] = useState('')

  const query = useQuery({
    queryKey: ['salon', activeSalonId, 'packages', search, status],
    queryFn: () => listPackages({ search, status }),
    placeholderData: keepPreviousData,
  })
  const servicesQuery = useQuery({ queryKey: ['salon', activeSalonId, 'services'], queryFn: listServices })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['salon', activeSalonId] })
  const toggle = useMutation({
    mutationFn: ({ id, active }) => updatePackage(id, { active }),
    onSuccess: () => {
      setActionError('')
      refresh()
    },
    onError: (e) => setActionError(friendlyError(e)),
  })

  const packages = query.data?.packages ?? []
  const today = query.data?.today ?? ''
  const services = (servicesQuery.data?.services ?? []).filter((s) => s.active)
  const saleLabel = (p) => {
    if (!p.active) return { label: 'Off', color: 'default' }
    if (p.saleEndsOn && today > p.saleEndsOn) return { label: 'Sale ended', color: 'default' }
    if (p.saleStartsOn && today < p.saleStartsOn) return { label: 'Upcoming', color: 'info' }
    return { label: 'On sale', color: 'success' }
  }

  return (
    <>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" fullWidth={false} label="Search packages" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ width: 260 }} />
        <TextField select size="small" fullWidth={false} label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ width: 150 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Switched off</MenuItem>
        </TextField>
        <Box sx={{ flexGrow: 1 }} />
        {canWrite && (
          <Button variant="contained" onClick={() => setEditing(null)} disabled={servicesQuery.isPending}>
            Add package
          </Button>
        )}
      </Box>
      {!canWrite && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You can see and sell packages. Only the owner or a manager can create or change them.
        </Alert>
      )}
      {actionError && (
        <Alert severity="error" onClose={() => setActionError('')} sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}
      {canWrite && !servicesQuery.isPending && services.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Add some services first. A package is made from your services.
        </Alert>
      )}

      <QueryState
        query={query}
        isEmpty={packages.length === 0}
        empty={<Alert severity="info">{search || status ? 'No packages match this search.' : `No packages yet. ${canWrite ? 'Add your first package.' : ''}`}</Alert>}
      >
        <TableContainer component={Paper}>
          <ResponsiveTable size="small" aria-label="Packages">
            <TableHead>
              <TableRow>
                <TableCell>Package</TableCell>
                <TableCell>Includes</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell>Valid</TableCell>
                <TableCell>Status</TableCell>
                {canWrite && <TableCell>On</TableCell>}
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {packages.map((p) => {
                const st = saleLabel(p)
                return (
                  <TableRow key={p.id} sx={{ opacity: p.active ? 1 : 0.55 }}>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600 }}>{p.name}</Typography>
                      {p.description && (
                        <Typography variant="caption" color="text.secondary">
                          {p.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{p.items.map((i) => `${i.sessions}× ${i.serviceName}`).join(', ')}</TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontWeight: 700 }}>{formatMoney(p.packagePrice)}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                        {formatMoney(p.originalPrice)}
                      </Typography>{' '}
                      <Typography variant="caption" color="success.main">
                        Save {p.savingsPercent}%
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {p.validityDays} days
                      {(p.saleStartsOn || p.saleEndsOn) && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Sale {p.saleStartsOn || '…'} to {p.saleEndsOn || '…'}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" color={st.color} label={st.label} />
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <Switch
                          checked={p.active}
                          disabled={toggle.isPending}
                          onChange={(e) => toggle.mutate({ id: p.id, active: e.target.checked })}
                          slotProps={{ input: { 'aria-label': `${p.name} on` } }}
                        />
                      </TableCell>
                    )}
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {canSell && st.label === 'On sale' && (
                        <Button size="small" onClick={() => onAssign(p.id)}>
                          Assign
                        </Button>
                      )}
                      {canWrite && (
                        <Button size="small" onClick={() => setEditing(p)}>
                          Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </ResponsiveTable>
        </TableContainer>
      </QueryState>

      {editing !== undefined && (
        <PackageDialog
          pkg={editing}
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

// ---------- Tab 2: customers ko diye gaye packages ----------
function AssignedTab({ canSell }) {
  const { activeSalonId } = useAuth()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState(null)

  const query = useQuery({
    queryKey: ['salon', activeSalonId, 'customer-packages', search, status, page],
    queryFn: () => listCustomerPackages({ search, status, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
  const rows = query.data?.data.customerPackages ?? []
  const total = query.data?.meta?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField size="small" fullWidth={false} label="Search customer, phone or package" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} sx={{ width: { xs: '100%', sm: 320 } }} />
        <TextField select size="small" fullWidth={false} label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} sx={{ width: 150 }}>
          <MenuItem value="">All</MenuItem>
          {Object.entries(STATUS_CHIP).map(([value, c]) => (
            <MenuItem key={value} value={value}>
              {c.label}
            </MenuItem>
          ))}
        </TextField>
      </Box>
      <QueryState
        query={query}
        isEmpty={rows.length === 0}
        empty={<Alert severity="info">{search || status ? 'Nothing matches this search.' : `No package has been sold yet. ${canSell ? 'Use "Assign" on a package to sell one.' : ''}`}</Alert>}
      >
        <TableContainer component={Paper}>
          <ResponsiveTable size="small" aria-label="Customer packages">
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell>Package</TableCell>
                <TableCell>Sessions left</TableCell>
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
                  <TableCell>{r.packageName}</TableCell>
                  <TableCell>
                    {r.remainingSessions} / {r.totalSessions}
                  </TableCell>
                  <TableCell>{r.expiresOn}</TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" color={r.paymentStatus === 'paid' ? 'success' : 'warning'} label={r.paymentStatus === 'paid' ? 'Paid' : 'Pending'} />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={STATUS_CHIP[r.status].color} label={STATUS_CHIP[r.status].label} />
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
      {openId && <CustomerPackageDialog id={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}

// Packages aur Memberships ka ek hi page, 4 tabs ke saath.
export default function PackagesPage() {
  const { role, activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const canWrite = roleCan(role, 'packages.write')
  const canSell = roleCan(role, 'packages.sell')
  const canWritePlans = roleCan(role, 'memberships.write')
  const canSellMembership = roleCan(role, 'memberships.sell')
  const [assignPlanFor, setAssignPlanFor] = useState(undefined) // undefined = band, string = plan id
  const [tab, setTab] = useState('packages')
  const [notice, setNotice] = useState('')
  const [assignFor, setAssignFor] = useState(undefined) // undefined = band, string = package id ('' = koi nahi chuna)

  const packagesQuery = useQuery({ queryKey: ['salon', activeSalonId, 'packages', '', ''], queryFn: () => listPackages({}) })
  const sellable = (packagesQuery.data?.packages ?? []).filter((p) => p.active)
  const plansQuery = useQuery({ queryKey: ['salon', activeSalonId, 'membership-plans', '', ''], queryFn: () => listMembershipPlans({}) })
  const sellablePlans = (plansQuery.data?.plans ?? []).filter((p) => p.active)
  const onMembershipTab = tab === 'plans' || tab === 'members'

  return (
    <Box sx={{ maxWidth: 1100 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800, color: 'primary.main', flexGrow: 1 }}>
          Packages & Memberships
        </Typography>
        {!onMembershipTab && canSell && (
          <Button variant="outlined" onClick={() => setAssignFor('')} disabled={sellable.length === 0}>
            Assign package to customer
          </Button>
        )}
        {onMembershipTab && canSellMembership && (
          <Button variant="outlined" onClick={() => setAssignPlanFor('')} disabled={sellablePlans.length === 0}>
            Assign membership to customer
          </Button>
        )}
      </Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="packages" label="Packages" />
        <Tab value="assigned" label="Customer packages" />
        <Tab value="plans" label="Membership plans" />
        <Tab value="members" label="Members" />
      </Tabs>

      {tab === 'packages' && <PackagesTab canWrite={canWrite} canSell={canSell} onAssign={setAssignFor} notify={setNotice} />}
      {tab === 'assigned' && <AssignedTab canSell={canSell} />}
      {tab === 'plans' && <PlansTab canWrite={canWritePlans} canSell={canSellMembership} onAssign={setAssignPlanFor} notify={setNotice} />}
      {tab === 'members' && <MembersTab canSell={canSellMembership} />}

      {assignPlanFor !== undefined && (
        <AssignMembershipDialog
          plans={sellablePlans}
          initialPlanId={assignPlanFor}
          onClose={() => setAssignPlanFor(undefined)}
          onSaved={(message) => {
            setAssignPlanFor(undefined)
            setNotice(message)
            setTab('members')
            queryClient.invalidateQueries({ queryKey: ['salon', activeSalonId] })
          }}
        />
      )}

      {assignFor !== undefined && (
        <AssignPackageDialog
          packages={sellable}
          initialPackageId={assignFor}
          onClose={() => setAssignFor(undefined)}
          onSaved={(message) => {
            setAssignFor(undefined)
            setNotice(message)
            setTab('assigned')
            queryClient.invalidateQueries({ queryKey: ['salon', activeSalonId] })
          }}
        />
      )}
      <Snackbar open={Boolean(notice)} autoHideDuration={3000} onClose={() => setNotice('')} message={notice} />
    </Box>
  )
}
