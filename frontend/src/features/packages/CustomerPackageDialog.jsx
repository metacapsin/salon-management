import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import DialogCloseButton from '../../components/DialogCloseButton'
import { friendlyError } from '../../api/client'
import { adjustPackage, cancelCustomerPackage, getCustomerPackage, markPackagePaid } from '../../api/packagesApi'
import QueryState from '../../components/QueryState'
import { useAuth } from '../../auth/AuthContext'
import { roleCan } from '../../auth/permissions'
import { formatMoney } from '../../utils/formatMoney'

export const STATUS_CHIP = {
  active: { label: 'Active', color: 'success' },
  upcoming: { label: 'Upcoming', color: 'info' },
  expired: { label: 'Expired', color: 'default' },
  exhausted: { label: 'Used up', color: 'default' },
  cancelled: { label: 'Cancelled', color: 'error' },
}

const TYPE_LABEL = { purchase: 'Purchased', redemption: 'Session used', adjustment: 'Adjusted', payment: 'Payment received', cancel: 'Cancelled' }
const when = (iso) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

// Ek customer ke package ki poori tasveer: sessions ka balance, aur khareed/use/adjustment ka itihaas.
export default function CustomerPackageDialog({ id, onClose, onChanged }) {
  const { role, activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const canSell = roleCan(role, 'packages.sell')
  const canAdjust = roleCan(role, 'packages.adjust')
  const [error, setError] = useState('')
  const [adjust, setAdjust] = useState({ serviceId: '', sessions: '', note: '' })
  const [cancelNote, setCancelNote] = useState('')
  const [showCancel, setShowCancel] = useState(false)

  const key = ['salon', activeSalonId, 'customer-package', id]
  const query = useQuery({ queryKey: key, queryFn: () => getCustomerPackage(id) })
  const done = () => {
    setError('')
    queryClient.invalidateQueries({ queryKey: ['salon', activeSalonId] })
    onChanged?.()
  }
  const fail = (e) => setError(friendlyError(e))
  const pay = useMutation({ mutationFn: (m) => markPackagePaid(id, m), onSuccess: done, onError: fail })
  const adj = useMutation({
    mutationFn: () => adjustPackage(id, { serviceId: adjust.serviceId, sessions: Number(adjust.sessions), note: adjust.note }),
    onSuccess: () => {
      setAdjust({ serviceId: '', sessions: '', note: '' })
      done()
    },
    onError: fail,
  })
  const cancel = useMutation({ mutationFn: () => cancelCustomerPackage(id, cancelNote), onSuccess: () => { setShowCancel(false); done() }, onError: fail })

  const cp = query.data?.customerPackage
  const history = query.data?.history ?? []
  const live = cp && !['cancelled'].includes(cp.status)
  const adjustValid = adjust.serviceId && Number.isInteger(Number(adjust.sessions)) && Number(adjust.sessions) !== 0 && adjust.note.trim().length >= 3

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogCloseButton onClose={onClose} />
      <DialogTitle sx={{ pr: 7 }}>{cp ? `${cp.packageName} — ${cp.customerName}` : 'Package details'}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2 }}>
        <QueryState query={query} isEmpty={!cp}>
          {cp && (
            <>
              {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip size="small" color={STATUS_CHIP[cp.status].color} label={STATUS_CHIP[cp.status].label} />
                <Chip size="small" variant="outlined" color={cp.paymentStatus === 'paid' ? 'success' : 'warning'} label={cp.paymentStatus === 'paid' ? `Paid ${formatMoney(cp.pricePaid)} (${cp.paymentMethod})` : `Payment pending ${formatMoney(cp.pricePaid)}`} />
                <Typography variant="body2" color="text.secondary">
                  {cp.customerPhone} · {cp.startsOn} to {cp.expiresOn}
                </Typography>
              </Box>
              {cp.paymentStatus === 'pending' && canSell && live && (
                <Box>
                  <Button size="small" variant="outlined" disabled={pay.isPending} onClick={() => pay.mutate('cash')}>
                    Mark paid (cash)
                  </Button>{' '}
                  <Button size="small" variant="outlined" disabled={pay.isPending} onClick={() => pay.mutate('upi')}>
                    Mark paid (UPI)
                  </Button>
                </Box>
              )}

              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Sessions ({cp.remainingSessions} of {cp.totalSessions} left)
              </Typography>
              {cp.items.map((i) => (
                <Box key={i.serviceId}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>{i.serviceName}</Typography>
                    <Typography color="text.secondary">
                      {i.used} used · <b>{i.remaining} left</b> / {i.total}
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={i.total ? (i.used / i.total) * 100 : 0} />
                </Box>
              ))}
              <Typography variant="caption" color="text.secondary">
                Sessions are used from a completed appointment, so each one is tied to a real visit.
              </Typography>

              <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>
                History
              </Typography>
              <Table size="small" aria-label="Package history">
                <TableHead>
                  <TableRow>
                    <TableCell>When</TableCell>
                    <TableCell>What</TableCell>
                    <TableCell>Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{when(h.at)}</TableCell>
                      <TableCell>{TYPE_LABEL[h.type]}</TableCell>
                      <TableCell>
                        {h.serviceName && `${h.serviceName} `}
                        {h.type === 'redemption' || h.type === 'adjustment' ? `(${h.sessions > 0 ? '+' : ''}${h.sessions}) ` : ''}
                        {(h.type === 'purchase' || h.type === 'payment') && formatMoney(h.amount)} {h.note}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {canAdjust && live && (
                <Box sx={{ display: 'grid', gap: 1, mt: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Fix the balance (reason is recorded)
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1.2fr 0.6fr 1.6fr auto' }, alignItems: 'start' }}>
                    <TextField select size="small" label="Service" value={adjust.serviceId} onChange={(e) => setAdjust({ ...adjust, serviceId: e.target.value })}>
                      {cp.items.map((i) => (
                        <MenuItem key={i.serviceId} value={i.serviceId}>
                          {i.serviceName}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField size="small" label="+/- sessions" type="number" value={adjust.sessions} onChange={(e) => setAdjust({ ...adjust, sessions: e.target.value })} />
                    <TextField size="small" label="Reason" value={adjust.note} onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} />
                    <Button variant="outlined" disabled={!adjustValid || adj.isPending} onClick={() => adj.mutate()}>
                      Apply
                    </Button>
                  </Box>
                  {showCancel ? (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <TextField size="small" fullWidth label="Why cancel this package?" value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} />
                      <Button color="error" variant="contained" disabled={cancelNote.trim().length < 3 || cancel.isPending} onClick={() => cancel.mutate()}>
                        Confirm cancel
                      </Button>
                    </Box>
                  ) : (
                    <Button color="error" sx={{ justifySelf: 'start' }} onClick={() => setShowCancel(true)}>
                      Cancel this package
                    </Button>
                  )}
                </Box>
              )}
            </>
          )}
        </QueryState>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
