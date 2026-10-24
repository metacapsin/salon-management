import { useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material'
import { friendlyError } from '../../api/client'
import { getPlatformSalon, setPlatformSalonStatus } from '../../api/platformApi'
import QueryState from '../../components/QueryState'

function Field({ label, children }) {
  return (
    <Box sx={{ py: 0.75 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography>{children || '—'}</Typography>
    </Box>
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

  return (
    <Box sx={{ maxWidth: 800 }}>
      <Button component={RouterLink} to="/admin/salons" sx={{ mb: 1 }}>
        ← All salons
      </Button>
      <QueryState query={query}>
        {salon && (
          <>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 800, color: 'primary.main' }}>
                {salon.name}
              </Typography>
              <Chip label={salon.status} color={salon.status === 'active' ? 'success' : 'warning'} />
              <Button variant="outlined" color={nextStatus === 'suspended' ? 'error' : 'success'} onClick={() => setDialogOpen(true)} sx={{ ml: 'auto' }}>
                {nextStatus === 'suspended' ? 'Suspend salon' : 'Activate salon'}
              </Button>
            </Box>
            <Card>
              <CardContent sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
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
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <Field label="About">{salon.about}</Field>
                </Box>
              </CardContent>
            </Card>
          </>
        )}
      </QueryState>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{nextStatus === 'suspended' ? 'Suspend this salon?' : 'Activate this salon?'}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
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
    </Box>
  )
}
