import { useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material'
import { ApiError, fieldErrorsOf, friendlyError } from '../../api/client'
import { assignPackage } from '../../api/packagesApi'
import DialogCloseButton from '../../components/DialogCloseButton'
import { formatMoney } from '../../utils/formatMoney'
import { applyServerFieldErrors, assignPackageSchema } from '../../utils/formSchemas'
import { field } from '../../utils/muiForm'

const today = () => new Date().toLocaleDateString('en-CA')

// Customer ko package dena. Price yahan se nahi jaata: server package ka price khud lagata hai.
export default function AssignPackageDialog({ packages, initialPackageId = '', onClose, onSaved }) {
  const [formError, setFormError] = useState('')
  const [duplicate, setDuplicate] = useState(false)
  // Har dialog ki ek hi key: double click ya retry par bhi sirf ek hi bikri banegi
  const requestKey = useRef(crypto.randomUUID())
  const {
    register,
    handleSubmit,
    setError,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(assignPackageSchema),
    defaultValues: { packageId: initialPackageId, customerPhone: '', customerName: '', paymentStatus: 'paid', paymentMethod: 'cash', startsOn: today() },
  })
  const chosen = packages.find((p) => p.id === watch('packageId'))

  async function submit(values, confirmDuplicate = false) {
    setFormError('')
    try {
      await assignPackage({ ...values, requestKey: requestKey.current, confirmDuplicate })
      onSaved('Package assigned.')
    } catch (error) {
      if (error instanceof ApiError && error.code === 'DUPLICATE_PACKAGE') {
        setDuplicate(true)
        setFormError(error.message)
        return
      }
      applyServerFieldErrors(fieldErrorsOf(error), setError)
      setFormError(friendlyError(error))
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogCloseButton onClose={onClose} />
      <Box component="form" onSubmit={handleSubmit((v) => submit(v, false))} noValidate>
        <DialogTitle sx={{ pr: 7 }}>Assign package to a customer</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
          {formError && <Alert severity={duplicate ? 'warning' : 'error'}>{formError}</Alert>}
          <Controller
            name="packageId"
            control={control}
            render={({ field: f }) => (
              <TextField select label="Package" value={f.value} onChange={f.onChange} error={Boolean(errors.packageId)} helperText={errors.packageId?.message}>
                {packages.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name} — {formatMoney(p.packagePrice)}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          {chosen && (
            <Alert severity="info" icon={false}>
              Customer pays {formatMoney(chosen.packagePrice)} · valid {chosen.validityDays} days ·{' '}
              {chosen.items.map((i) => `${i.sessions}× ${i.serviceName}`).join(', ')}
            </Alert>
          )}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField label="Mobile number" inputMode="numeric" {...field(register, errors, 'customerPhone')} />
            <TextField label="Customer name" {...field(register, errors, 'customerName')} />
          </Box>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
            <Controller
              name="paymentStatus"
              control={control}
              render={({ field: f }) => (
                <TextField select label="Payment" value={f.value} onChange={f.onChange}>
                  <MenuItem value="paid">Paid</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                </TextField>
              )}
            />
            <Controller
              name="paymentMethod"
              control={control}
              render={({ field: f }) => (
                <TextField select label="Method" value={f.value} onChange={f.onChange}>
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="upi">UPI</MenuItem>
                  <MenuItem value="card">Card</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </TextField>
              )}
            />
            <TextField label="Starts on" type="date" slotProps={{ inputLabel: { shrink: true } }} {...field(register, errors, 'startsOn')} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          {duplicate && (
            <Button color="warning" disabled={isSubmitting} onClick={handleSubmit((v) => submit(v, true))}>
              Sell another anyway
            </Button>
          )}
          <Button type="submit" variant="contained" disabled={isSubmitting || duplicate}>
            {isSubmitting ? 'Assigning…' : 'Assign package'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
