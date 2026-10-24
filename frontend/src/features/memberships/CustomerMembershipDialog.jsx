import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import DialogCloseButton from '../../components/DialogCloseButton'
import { friendlyError } from '../../api/client'
import { cancelCustomerMembership, getCustomerMembership, markMembershipPaid } from '../../api/membershipsApi'
import { useAuth } from '../../auth/AuthContext'
import { roleCan } from '../../auth/permissions'
import QueryState from '../../components/QueryState'
import { formatMoney } from '../../utils/formatMoney'
import { MEMBERSHIP_STATUS } from './status'

const TYPE_LABEL = { purchase: 'Purchased', payment: 'Payment received', discount: 'Discount used', cancel: 'Cancelled' }
const when = (iso) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

// Ek member ki poori tasveer: shartein, payment, expiry aur khareed/discount ka itihaas.
export default function CustomerMembershipDialog({ id, onClose }) {
  const { role, activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const canSell = roleCan(role, 'memberships.sell')
  const canAdjust = roleCan(role, 'memberships.adjust')
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [showCancel, setShowCancel] = useState(false)

  const query = useQuery({ queryKey: ['salon', activeSalonId, 'customer-membership', id], queryFn: () => getCustomerMembership(id) })
  const done = () => {
    setError('')
    queryClient.invalidateQueries({ queryKey: ['salon', activeSalonId] })
  }
  const fail = (e) => setError(friendlyError(e))
  const pay = useMutation({ mutationFn: (m) => markMembershipPaid(id, m), onSuccess: done, onError: fail })
  const cancel = useMutation({ mutationFn: () => cancelCustomerMembership(id, note), onSuccess: () => { setShowCancel(false); done() }, onError: fail })

  const cm = query.data?.customerMembership
  const history = query.data?.history ?? []
  const saved = history.filter((h) => h.type === 'discount').reduce((s, h) => s + h.amount, 0)
  const live = cm && cm.status !== 'cancelled'

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogCloseButton onClose={onClose} />
      <DialogTitle sx={{ pr: 7 }}>{cm ? `${cm.planName} — ${cm.customerName}` : 'Membership details'}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2 }}>
        <QueryState query={query} isEmpty={!cm}>
          {cm && (
            <>
              {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip size="small" color={MEMBERSHIP_STATUS[cm.status].color} label={MEMBERSHIP_STATUS[cm.status].label} />
                <Chip size="small" variant="outlined" color={cm.paymentStatus === 'paid' ? 'success' : 'warning'} label={cm.paymentStatus === 'paid' ? `Paid ${formatMoney(cm.pricePaid)} (${cm.paymentMethod})` : `Payment pending ${formatMoney(cm.pricePaid)}`} />
                <Typography variant="body2" color="text.secondary">
                  {cm.customerPhone} · {cm.startsOn} to {cm.expiresOn}
                </Typography>
              </Box>
              {cm.status === 'active' && !cm.benefitsActive && <Alert severity="warning">Benefits start once the payment is received.</Alert>}
              {cm.status === 'expired' && <Alert severity="warning">This membership has expired, so it gives no discount.</Alert>}
              {cm.paymentStatus === 'pending' && canSell && live && (
                <Box>
                  <Button size="small" variant="outlined" disabled={pay.isPending} onClick={() => pay.mutate('cash')}>
                    Mark paid (cash)
                  </Button>{' '}
                  <Button size="small" variant="outlined" disabled={pay.isPending} onClick={() => pay.mutate('upi')}>
                    Mark paid (UPI)
                  </Button>
                </Box>
              )}
              <Typography>
                <b>{cm.discountType === 'percent' ? `${cm.discountValue}% off` : `${formatMoney(cm.discountValue)} off`}</b> on{' '}
                {cm.serviceIds.length === 0 ? 'all services' : `${cm.serviceIds.length} selected service(s)`}. Total saved so far: <b>{formatMoney(saved)}</b>
              </Typography>
              {cm.benefits.length > 0 && <Typography variant="body2">Other benefits: {cm.benefits.join(', ')}</Typography>}

              <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>
                History
              </Typography>
              <Table size="small" aria-label="Membership history">
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
                        {h.type !== 'cancel' && formatMoney(h.amount)} {h.note}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {canAdjust && live && (
                <Box sx={{ mt: 1 }}>
                  {showCancel ? (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <TextField size="small" fullWidth label="Why cancel this membership?" value={note} onChange={(e) => setNote(e.target.value)} />
                      <Button color="error" variant="contained" disabled={note.trim().length < 3 || cancel.isPending} onClick={() => cancel.mutate()}>
                        Confirm cancel
                      </Button>
                    </Box>
                  ) : (
                    <Button color="error" onClick={() => setShowCancel(true)}>
                      Cancel this membership
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
