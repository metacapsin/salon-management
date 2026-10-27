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
  FormHelperText,
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
import CloseIcon from '@mui/icons-material/Close'
import { fieldErrorsOf, friendlyError } from '../api/client'
import { createService, listServices, updateService } from '../api/salonApi'
import { useAuth } from '../auth/AuthContext'
import { roleCan } from '../auth/permissions'
import QueryState from '../components/QueryState'
import { SERVICE_CATEGORIES } from '../data/serviceCategories'
import { formatMoney } from '../utils/formatMoney'
import { applyServerFieldErrors, serviceSchema } from '../utils/formSchemas'
import { field } from '../utils/muiForm'
import ResponsiveTable from '../components/ResponsiveTable'
import EditIcon from '@mui/icons-material/EditOutlined'

const EMPTY = { name: '', category: 'Hair', description: '', price: '', durationMin: 30, atSalon: true, atHome: false }

// Naya service jodna ya purani badalna (service=null matlab naya)
function ServiceDialog({ service, onClose, onSaved }) {
  const [formError, setFormError] = useState('')
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(serviceSchema),
    defaultValues: service ? { ...EMPTY, ...service } : EMPTY,
  })

  async function submit(values) {
    setFormError('')
    try {
      if (service) await updateService(service.id, values)
      else await createService(values)
      onSaved(service ? 'Service updated.' : 'Service added.')
    } catch (error) {
      applyServerFieldErrors(fieldErrorsOf(error), setError)
      setFormError(friendlyError(error))
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={handleSubmit(submit)} noValidate>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
          {service ? 'Edit service' : 'Add a service'}
          <IconButton aria-label="Cancel" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField label="Service name" autoFocus {...field(register, errors, 'name')} />
          <Controller
            name="category"
            control={control}
            render={({ field: f }) => (
              <TextField
                select
                label="Category"
                value={f.value}
                onChange={f.onChange}
                slotProps={{ select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: 240 } } } } } }}
              >
                {SERVICE_CATEGORIES.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField label="Price (₹)" type="number" slotProps={{ htmlInput: { min: 0, step: 1 } }} {...field(register, errors, 'price')} />
            <TextField
              label="Duration (minutes)"
              type="number"
              slotProps={{ htmlInput: { min: 5, max: 480, step: 5 } }}
              {...field(register, errors, 'durationMin')}
            />
          </Box>
          <TextField label="Description (optional)" multiline minRows={2} {...field(register, errors, 'description')} />
          <Box>
            <Typography variant="subtitle2">Where is this service given?</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Controller
                name="atSalon"
                control={control}
                render={({ field: f }) => <FormControlLabel control={<Checkbox checked={f.value} onChange={(e) => f.onChange(e.target.checked)} />} label="At the salon" />}
              />
              <Controller
                name="atHome"
                control={control}
                render={({ field: f }) => <FormControlLabel control={<Checkbox checked={f.value} onChange={(e) => f.onChange(e.target.checked)} />} label="At the customer's home" />}
              />
            </Box>
            {errors.atSalon && <FormHelperText error>{errors.atSalon.message}</FormHelperText>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save service'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

// Salon ki price list. Owner/Manager badal sakte hain; baaki sirf dekh sakte hain.
export default function ServicesPage() {
  const { role, activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const canWrite = roleCan(role, 'services.write')
  const [editing, setEditing] = useState(undefined) // undefined = dialog band, null = naya, object = badalna
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')

  const query = useQuery({ queryKey: ['salon', activeSalonId, 'services'], queryFn: listServices })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['salon', activeSalonId] })

  const toggle = useMutation({
    mutationFn: ({ id, active }) => updateService(id, { active }),
    onSuccess: () => {
      setActionError('')
      refresh()
    },
    onError: (error) => setActionError(friendlyError(error)),
  })

  const services = query.data?.services ?? []

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
          Your price list. Customers see these services when they book.
        </Typography>
        {canWrite && (
          <Button variant="contained" onClick={() => setEditing(null)}>
            Add service
          </Button>
        )}
      </Box>
      {!canWrite && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You can see the price list. Only the owner or a manager can change it.
        </Alert>
      )}
      {actionError && (
        <Alert severity="error" onClose={() => setActionError('')} sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      <QueryState
        query={query}
        isEmpty={services.length === 0}
        empty={<Alert severity="info">No services yet. {canWrite ? 'Add your first service so customers can book you.' : ''}</Alert>}
      >
        <TableContainer component={Paper}>
          <ResponsiveTable size="small" aria-label="Services">
            <TableHead>
              <TableRow>
                <TableCell>Service</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="right">Time</TableCell>
                <TableCell>Where</TableCell>
                <TableCell>Active</TableCell>
                {canWrite && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {services.map((s) => (
                <TableRow key={s.id} sx={{ opacity: s.active ? 1 : 0.55 }}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600 }}>{s.name}</Typography>
                    {s.description && (
                      <Typography variant="caption" color="text.secondary">
                        {s.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{s.category}</TableCell>
                  <TableCell align="right">{formatMoney(s.price)}</TableCell>
                  <TableCell align="right">{s.durationMin} min</TableCell>
                  <TableCell>
                    {s.atSalon && <Chip size="small" label="Salon" sx={{ mr: 0.5 }} />}
                    {s.atHome && <Chip size="small" color="secondary" label="Home" />}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={s.active}
                      disabled={!canWrite || toggle.isPending}
                      onChange={(e) => toggle.mutate({ id: s.id, active: e.target.checked })}
                      slotProps={{ input: { 'aria-label': `${s.name} active` } }}
                    />
                  </TableCell>
                  {canWrite && (
                    <TableCell align="right">
                      <IconButton size="small" aria-label="Edit" title="Edit" sx={{ minWidth: 36, minHeight: 36 }} onClick={() => setEditing(s)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </ResponsiveTable>
        </TableContainer>
      </QueryState>

      {editing !== undefined && (
        <ServiceDialog
          service={editing}
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
