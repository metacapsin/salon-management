import { useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material'
import DialogCloseButton from '../../components/DialogCloseButton'
import { fieldErrorsOf, friendlyError } from '../../api/client'
import { assignMembership } from '../../api/membershipsApi'
import { formatMoney } from '../../utils/formatMoney'
import { applyServerFieldErrors, assignMembershipSchema } from '../../utils/formSchemas'
import { field } from '../../utils/muiForm'

const today = () => new Date().toLocaleDateString('en-CA')
export const discountText = (p) => (p.discountType === 'percent' ? `${p.discountValue}% off` : `${formatMoney(p.discountValue)} off`)

// Customer ko membership dena. Price yahan se nahi jaata: server plan ka price khud lagata hai.
export default function AssignMembershipDialog({ plans, initialPlanId = '', onClose, onSaved }) {
  const [formError, setFormError] = useState('')
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
    resolver: zodResolver(assignMembershipSchema),
    defaultValues: { planId: initialPlanId, customerPhone: '', customerName: '', paymentStatus: 'paid', paymentMethod: 'cash', startsOn: today() },
  })
  const chosen = plans.find((p) => p.id === watch('planId'))

  async function submit(values) {
    setFormError('')
    try {
      await assignMembership({ ...values, requestKey: requestKey.current })
      onSaved('Membership assigned.')
    } catch (error) {
      applyServerFieldErrors(fieldErrorsOf(error), setError)
      setFormError(friendlyError(error))
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogCloseButton onClose={onClose} />
      <Box component="form" onSubmit={handleSubmit(submit)} noValidate>
        <DialogTitle sx={{ pr: 7 }}>Assign membership to a customer</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <Controller
            name="planId"
            control={control}
            render={({ field: f }) => (
              <TextField select label="Plan" value={f.value} onChange={f.onChange} error={Boolean(errors.planId)} helperText={errors.planId?.message}>
                {plans.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name} — {formatMoney(p.price)}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          {chosen && (
            <Alert severity="info" icon={false}>
              Customer pays {formatMoney(chosen.price)} · {discountText(chosen)} · valid {chosen.durationDays} days
              {chosen.benefits.length > 0 && ` · ${chosen.benefits.join(', ')}`}
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
                <TextField select label="Payment" value={f.value} onChange={f.onChange} helperText={f.value === 'pending' ? 'No discount until paid.' : undefined}>
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
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Assigning…' : 'Assign membership'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
