import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
  Switch,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { fieldErrorsOf, friendlyError } from '../api/client'
import { createOffer, listOffers, listServices, updateOffer } from '../api/salonApi'
import { useAuth } from '../auth/AuthContext'
import { roleCan } from '../auth/permissions'
import QueryState from '../components/QueryState'
import { formatMoney } from '../utils/formatMoney'
import { applyServerFieldErrors, offerSchema } from '../utils/formSchemas'
import { field } from '../utils/muiForm'
import ResponsiveTable from '../components/ResponsiveTable'
import EditIcon from '@mui/icons-material/EditOutlined'

const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD
const EMPTY = {
  title: '',
  description: '',
  discountType: 'percent',
  discountValue: '',
  serviceIds: [],
  startsOn: today(),
  endsOn: today(),
  oncePerCustomer: false,
}

const discountText = (o) => (o.discountType === 'percent' ? `${o.discountValue}% off` : `${formatMoney(o.discountValue)} off`)

// Offer ki halat: band / aane wala / chal raha / khatam
function statusOf(o) {
  const now = today()
  if (!o.active) return { label: 'Off', color: 'default' }
  if (o.endsOn < now) return { label: 'Expired', color: 'default' }
  if (o.startsOn > now) return { label: 'Upcoming', color: 'info' }
  return { label: 'Running', color: 'success' }
}

// Naya offer banana ya purana badalna (offer=null matlab naya)
function OfferDialog({ offer, services, onClose, onSaved }) {
  const [formError, setFormError] = useState('')
  const {
    register,
    handleSubmit,
    setError,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(offerSchema),
    defaultValues: offer ? { ...EMPTY, ...offer } : EMPTY,
  })
  const isPercent = watch('discountType') === 'percent'

  async function submit(values) {
    setFormError('')
    try {
      if (offer) await updateOffer(offer.id, values)
      else await createOffer(values)
      onSaved(offer ? 'Offer updated.' : 'Offer added.')
    } catch (error) {
      applyServerFieldErrors(fieldErrorsOf(error), setError)
      setFormError(friendlyError(error))
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={handleSubmit(submit)} noValidate>
        <DialogTitle sx={{ pr: 6 }}>{offer ? 'Edit offer' : 'Add an offer'}</DialogTitle>
        <IconButton onClick={onClose} aria-label="Close" size="small" sx={{ position: 'absolute', top: 10, right: 10, fontSize: '0.85rem', width: 26, height: 26 }}>
          ✕
        </IconButton>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField label="Offer title" autoFocus {...field(register, errors, 'title')} />
            <TextField label="Description (optional)" {...field(register, errors, 'description')} />
          </Box>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
            <Controller
              name="discountType"
              control={control}
              render={({ field: f }) => (
                <TextField select label="Discount type" value={f.value} onChange={f.onChange}>
                  <MenuItem value="percent">Percentage (%)</MenuItem>
                  <MenuItem value="flat">Fixed amount (₹)</MenuItem>
                </TextField>
              )}
            />
            <TextField
              label={isPercent ? 'Discount (%)' : 'Discount (₹)'}
              type="number"
              slotProps={{ htmlInput: { min: 1, max: isPercent ? 100 : undefined, step: 1 } }}
              {...field(register, errors, 'discountValue')}
            />
          </Box>
          <Controller
            name="serviceIds"
            control={control}
            render={({ field: f }) => (
              <TextField
                select
                label="Applies to"
                value={f.value}
                onChange={f.onChange}
                helperText="Leave empty to apply to every service."
                slotProps={{
                  select: {
                    multiple: true,
                    displayEmpty: true,
                    renderValue: (ids) =>
                      ids.length === 0 ? 'All services' : services.filter((s) => ids.includes(s.id)).map((s) => s.name).join(', '),
                  },
                  inputLabel: { shrink: true },
                }}
              >
                {services.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
            <TextField label="Starts on" type="date" slotProps={{ inputLabel: { shrink: true } }} {...field(register, errors, 'startsOn')} />
            <TextField label="Ends on" type="date" slotProps={{ inputLabel: { shrink: true } }} {...field(register, errors, 'endsOn')} />
          </Box>
          <Controller
            name="oncePerCustomer"
            control={control}
            render={({ field: f }) => (
              <FormControlLabel control={<Checkbox checked={f.value} onChange={(e) => f.onChange(e.target.checked)} />} label="Each customer can use it only once" />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save offer'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

// Salon ke discount offers. Owner/Manager badal sakte hain; Receptionist sirf dekh sakta hai.
export default function OffersPage() {
  const { role, activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const canWrite = roleCan(role, 'offers.write')
  const [editing, setEditing] = useState(undefined) // undefined = dialog band, null = naya, object = badalna
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')

  const query = useQuery({ queryKey: ['salon', activeSalonId, 'offers'], queryFn: listOffers })
  const servicesQuery = useQuery({ queryKey: ['salon', activeSalonId, 'services'], queryFn: listServices })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['salon', activeSalonId] })

  const toggle = useMutation({
    mutationFn: ({ id, active }) => updateOffer(id, { active }),
    onSuccess: () => {
      setActionError('')
      refresh()
    },
    onError: (error) => setActionError(friendlyError(error)),
  })

  const offers = query.data?.offers ?? []
  const services = (servicesQuery.data?.services ?? []).filter((s) => s.active)
  const serviceNames = (o) => (o.serviceIds.length === 0 ? 'All services' : o.serviceIds.map((id) => services.find((s) => s.id === id)?.name ?? 'Removed service').join(', '))

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
          Discounts that customers can pick while booking.
        </Typography>
        {canWrite && (
          <Button variant="contained" onClick={() => setEditing(null)}>
            Add offer
          </Button>
        )}
      </Box>
      {!canWrite && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You can see the offers. Only the owner or a manager can change them.
        </Alert>
      )}
      {actionError && (
        <Alert severity="error" onClose={() => setActionError('')} sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      <QueryState
        query={query}
        isEmpty={offers.length === 0}
        empty={<Alert severity="info">No offers yet. {canWrite ? 'Add your first offer to bring in more customers.' : ''}</Alert>}
      >
        <TableContainer component={Paper}>
          <ResponsiveTable size="small" aria-label="Offers">
            <TableHead>
              <TableRow>
                <TableCell>Offer</TableCell>
                <TableCell>Discount</TableCell>
                <TableCell>Applies to</TableCell>
                <TableCell>Dates</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>On</TableCell>
                {canWrite && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {offers.map((o) => {
                const status = statusOf(o)
                return (
                  <TableRow key={o.id} sx={{ opacity: o.active ? 1 : 0.55 }}>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600 }}>{o.title}</Typography>
                      {o.description && (
                        <Typography variant="caption" color="text.secondary">
                          {o.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {discountText(o)}
                      {o.oncePerCustomer && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Once per customer
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{serviceNames(o)}</TableCell>
                    <TableCell>
                      {o.startsOn} to {o.endsOn}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" color={status.color} label={status.label} />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={o.active}
                        disabled={!canWrite || toggle.isPending}
                        onChange={(e) => toggle.mutate({ id: o.id, active: e.target.checked })}
                        slotProps={{ input: { 'aria-label': `${o.title} on` } }}
                      />
                    </TableCell>
                    {canWrite && (
                      <TableCell align="right">
                        <IconButton size="small" aria-label="Edit" title="Edit" sx={{ minWidth: 36, minHeight: 36 }} onClick={() => setEditing(o)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </ResponsiveTable>
        </TableContainer>
      </QueryState>

      {editing !== undefined && (
        <OfferDialog
          offer={editing}
          services={services}
          onClose={() => setEditing(undefined)}
          onSaved={(message) => {
            setEditing(undefined)
            setNotice(message)
            refresh()
          }}
        />
      )}
      <Snackbar open={Boolean(notice)} autoHideDuration={3000} onClose={() => setNotice('')} message={notice} />
    </Box>
  )
}
