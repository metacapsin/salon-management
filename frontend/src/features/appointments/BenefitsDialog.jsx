import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import DialogCloseButton from '../../components/DialogCloseButton'
import { friendlyError } from '../../api/client'
import { applyMembership } from '../../api/membershipsApi'
import { redeemPackage } from '../../api/packagesApi'
import { getBookingBenefits } from '../../api/salonApi'
import { useAuth } from '../../auth/AuthContext'
import { roleCan } from '../../auth/permissions'
import QueryState from '../../components/QueryState'
import { formatMoney } from '../../utils/formatMoney'
import { benefitsKey } from './benefitsKey'

// Appointment par customer ke package sessions aur membership discount.
// Session tabhi kat-ta hai jab appointment "done" ho (server bhi yahi check karta hai).
export default function BenefitsDialog({ booking, onClose }) {
  const { role, activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const canPackages = roleCan(role, 'packages.sell')
  const canMembership = roleCan(role, 'memberships.sell')

  const query = useQuery({ queryKey: benefitsKey(activeSalonId, booking.id), queryFn: () => getBookingBenefits(booking.id) })
  const done = (message) => {
    setError('')
    setNotice(message)
    queryClient.invalidateQueries({ queryKey: ['salon', activeSalonId] })
  }
  const fail = (e) => {
    setNotice('')
    setError(friendlyError(e))
  }
  const redeem = useMutation({
    mutationFn: ({ customerPackageId, serviceId }) => redeemPackage(customerPackageId, { bookingId: booking.id, serviceId }),
    onSuccess: () => done('One session used.'),
    onError: fail,
  })
  const apply = useMutation({
    mutationFn: (id) => applyMembership(id, booking.id),
    onSuccess: () => done('Membership discount applied.'),
    onError: fail,
  })

  const data = query.data
  const completed = data?.status === 'completed'
  const nothing = data && data.packages.length === 0 && !data.membership

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogCloseButton onClose={onClose} />
      <DialogTitle sx={{ pr: 7 }}>Benefits for {booking.customerName}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2 }}>
        <QueryState query={query} isEmpty={false}>
          {data && (
            <>
              {error && (
                <Alert severity="error" onClose={() => setError('')}>
                  {error}
                </Alert>
              )}
              {notice && (
                <Alert severity="success" onClose={() => setNotice('')}>
                  {notice}
                </Alert>
              )}
              <Typography variant="body2" color="text.secondary">
                {booking.services.map((s) => s.name).join(', ')} · Bill total {formatMoney(data.total)}
              </Typography>
              {nothing && <Alert severity="info">This customer has no active package or membership that applies to this appointment.</Alert>}

              {data.membership && (
                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                  <Typography sx={{ fontWeight: 700 }}>Membership: {data.membership.planName}</Typography>
                  {data.membership.applied ? (
                    <Chip size="small" color="success" label={`Discount applied: −${formatMoney(data.membership.discount)}`} sx={{ mt: 0.5 }} />
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                      <Typography variant="body2" sx={{ flexGrow: 1 }}>
                        Customer saves {formatMoney(data.membership.discount)} on this bill.
                      </Typography>
                      {canMembership && (
                        <Button variant="contained" size="small" disabled={apply.isPending} onClick={() => apply.mutate(data.membership.customerMembershipId)}>
                          Apply discount
                        </Button>
                      )}
                    </Box>
                  )}
                </Box>
              )}

              {data.packages.map((p) => (
                <Box key={p.customerPackageId} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                  <Typography sx={{ fontWeight: 700 }}>
                    Package: {p.packageName}{' '}
                    <Typography component="span" variant="caption" color="text.secondary">
                      (expires {p.expiresOn})
                    </Typography>
                  </Typography>
                  {p.services.map((s) => (
                    <Box key={s.serviceId} sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                      <Typography variant="body2" sx={{ flexGrow: 1 }}>
                        {s.serviceName} — {s.remaining} left
                      </Typography>
                      {s.redeemed ? (
                        <Chip size="small" color="success" label="Session used" />
                      ) : (
                        canPackages && (
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={!completed || redeem.isPending}
                            onClick={() => redeem.mutate({ customerPackageId: p.customerPackageId, serviceId: s.serviceId })}
                          >
                            Use 1 session
                          </Button>
                        )
                      )}
                    </Box>
                  ))}
                  {!completed && p.services.some((s) => !s.redeemed) && (
                    <Typography variant="caption" color="text.secondary">
                      Sessions can be used after the appointment is marked done.
                    </Typography>
                  )}
                </Box>
              ))}
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
