import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material'
import DialogCloseButton from '../../components/DialogCloseButton'
import { fieldErrorsOf, friendlyError } from '../../api/client'
import { createMembershipPlan, updateMembershipPlan } from '../../api/membershipsApi'
import { applyServerFieldErrors, membershipPlanSchema } from '../../utils/formSchemas'
import { field } from '../../utils/muiForm'

const EMPTY = { name: '', description: '', price: '', durationDays: 365, discountType: 'percent', discountValue: '', serviceIds: [], benefits: '' }

// Naya plan (Silver/Gold...) banana ya purana badalna (plan=null matlab naya). Sirf owner ke liye.
export default function MembershipPlanDialog({ plan, services, onClose, onSaved }) {
  const [formError, setFormError] = useState('')
  const {
    register,
    handleSubmit,
    setError,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(membershipPlanSchema),
    defaultValues: plan ? { ...EMPTY, ...plan, benefits: plan.benefits.join('\n') } : EMPTY,
  })
  const isPercent = watch('discountType') === 'percent'

  async function submit(values) {
    setFormError('')
    const body = { ...values, benefits: values.benefits.split('\n').map((b) => b.trim()).filter(Boolean) }
    try {
      if (plan) await updateMembershipPlan(plan.id, body)
      else await createMembershipPlan(body)
      onSaved(plan ? 'Plan updated.' : 'Plan added.')
    } catch (error) {
      applyServerFieldErrors(fieldErrorsOf(error), setError)
      setFormError(friendlyError(error))
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogCloseButton onClose={onClose} />
      <Box component="form" onSubmit={handleSubmit(submit)} noValidate>
        <DialogTitle sx={{ pr: 7 }}>{plan ? 'Edit membership plan' : 'Add a membership plan'}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          {plan && <Alert severity="info">Changes apply to new sales only. Members who already bought keep their original discount.</Alert>}
          <TextField label="Plan name (e.g. Gold)" autoFocus {...field(register, errors, 'name')} />
          <TextField label="Description (optional)" multiline minRows={2} {...field(register, errors, 'description')} />
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField label="Price (₹)" type="number" slotProps={{ htmlInput: { min: 0, step: 1 } }} {...field(register, errors, 'price')} />
            <TextField label="Valid for (days)" type="number" slotProps={{ htmlInput: { min: 1, max: 1095 } }} {...field(register, errors, 'durationDays')} />
          </Box>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
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
              label={isPercent ? 'Discount (%)' : 'Discount (₹ per visit)'}
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
                label="Discount applies to"
                value={f.value}
                onChange={f.onChange}
                helperText="Leave empty to apply to every service."
                slotProps={{
                  select: {
                    multiple: true,
                    displayEmpty: true,
                    renderValue: (ids) => (ids.length === 0 ? 'All services' : services.filter((s) => ids.includes(s.id)).map((s) => s.name).join(', ')),
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
          <TextField label="Other benefits (one per line, optional)" multiline minRows={2} {...field(register, errors, 'benefits')} />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save plan'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
