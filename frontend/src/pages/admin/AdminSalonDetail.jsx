import { useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material'
import { friendlyError } from '../../api/client'
import { getPlatformSalon, setPlatformSalonStatus } from '../../api/platformApi'
import AdminQueryState from '../../components/admin/AdminQueryState'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import Icon from '../../components/Icon'

function Field({ label, wide, children }) {
  return (
    <div className={wide ? 'ad-field ad-field--wide' : 'ad-field'}>
      <dt>{label}</dt>
      <dd>{children || '—'}</dd>
    </div>
  )
}

// Ek salon ki platform-level detail. Customers, billing aur bookings yahan nahi dikhte (salon ka private data).
export default function AdminSalonDetail() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['platform', 'salon', id], queryFn: () => getPlatformSalon(id) })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reason, setReason] = useState('')
  const salon = query.data?.salon

  const mutation = useMutation({
    mutationFn: (status) => setPlatformSalonStatus(id, { status, ...(reason.trim() ? { reason: reason.trim() } : {}) }),
    onSuccess: () => {
      setDialogOpen(false)
      setReason('')
      queryClient.invalidateQueries({ queryKey: ['platform'] })
    },
  })

  const nextStatus = salon?.status === 'suspended' ? 'active' : 'suspended'
  const address = [salon?.address?.line1, salon?.address?.area, salon?.address?.city, salon?.address?.state, salon?.address?.pincode].filter(Boolean).join(', ')
  const team = Object.entries(salon?.teamByRole ?? {})
    .map(([role, n]) => `${n} ${role}`)
    .join(', ')

  const back = (
    <RouterLink to="/admin/salons" className="ad-back">
      <Icon name="chevron" size={16} />
      All salons
    </RouterLink>
  )

  return (
    <>
      {salon ? (
        <PageHeader
          back={back}
          title={
            <span className="ad-title-row">
              {salon.name}
              <StatusPill label={salon.status} tone={salon.status === 'active' ? 'success' : 'warning'} />
            </span>
          }
          subtitle={salon.slug ? `Booking address: ${salon.slug}` : undefined}
          actions={
            <Button variant="outlined" color={nextStatus === 'suspended' ? 'error' : 'success'} onClick={() => setDialogOpen(true)}>
              {nextStatus === 'suspended' ? 'Suspend salon' : 'Activate salon'}
            </Button>
          }
        />
      ) : (
        <PageHeader back={back} title="Salon details" />
      )}
      <AdminQueryState query={query} rows={4}>
        {salon && (
          <section className="ad-panel" aria-label="Salon details">
            <div className="ad-panel__head">
              <div>
                <h2>Salon profile</h2>
                <p>Platform-level details. Customers, bookings and billing stay private to the salon.</p>
              </div>
            </div>
            <dl className="ad-detail">
              <Field label="Booking address (slug)">{salon.slug}</Field>
              <Field label="Registered on">{new Date(salon.createdAt).toLocaleString()}</Field>
              <Field label="Owner">{salon.ownerName}</Field>
              <Field label="Owner email">{salon.ownerEmail}</Field>
              <Field label="Owner phone">{salon.ownerPhone}</Field>
              <Field label="Team">{team}</Field>
              <Field label="Address">{address}</Field>
              <Field label="Timezone">{salon.timezone}</Field>
              <Field label="Audience">{salon.audience}</Field>
              <Field label="Booking page">{salon.publicBookingEnabled ? 'Published' : 'Not published'}</Field>
              <Field label="About" wide>
                {salon.about}
              </Field>
            </dl>
          </section>
        )}
      </AdminQueryState>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{nextStatus === 'suspended' ? 'Suspend this salon?' : 'Activate this salon?'}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }} color="text.secondary">
            {nextStatus === 'suspended' ? 'The salon team can still read their data, but they cannot make changes until you activate it again.' : 'The salon team can make changes again.'}
          </Typography>
          <TextField label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} fullWidth multiline minRows={2} slotProps={{ htmlInput: { maxLength: 300 } }} />
          {mutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {friendlyError(mutation.error)}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color={nextStatus === 'suspended' ? 'error' : 'success'} disabled={mutation.isPending} onClick={() => mutation.mutate(nextStatus)}>
            {nextStatus === 'suspended' ? 'Suspend' : 'Activate'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
