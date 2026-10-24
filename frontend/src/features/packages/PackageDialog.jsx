import { useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, TextField, Typography } from '@mui/material'
import DialogCloseButton from '../../components/DialogCloseButton'
import { fieldErrorsOf, friendlyError } from '../../api/client'
import { createPackage, updatePackage } from '../../api/packagesApi'
import { formatMoney } from '../../utils/formatMoney'
import { applyServerFieldErrors, packageSchema } from '../../utils/formSchemas'
import { field } from '../../utils/muiForm'

const EMPTY = { name: '', description: '', items: [{ serviceId: '', sessions: 1 }], packagePrice: '', validityDays: 90, saleStartsOn: '', saleEndsOn: '' }

// Naya package banana ya purana badalna (pkg=null matlab naya).
// Neeche dikhne wala "total" sirf andaza hai; asli price/bachat server service ke price se khud nikalta hai.
export default function PackageDialog({ pkg, services, onClose, onSaved }) {
  const [formError, setFormError] = useState('')
  const {
    register,
    handleSubmit,
    setError,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(packageSchema),
    defaultValues: pkg
      ? {
          ...EMPTY,
          ...pkg,
          items: pkg.items.map((i) => ({ serviceId: i.serviceId, sessions: i.sessions })),
          saleStartsOn: pkg.saleStartsOn ?? '',
          saleEndsOn: pkg.saleEndsOn ?? '',
        }
      : EMPTY,
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = watch('items')
  const price = Number(watch('packagePrice')) || 0
  const priceOf = (id) => services.find((s) => s.id === id)?.price ?? pkg?.items.find((i) => i.serviceId === id)?.unitPrice ?? 0
  const original = (items ?? []).reduce((sum, i) => sum + priceOf(i.serviceId) * (Number(i.sessions) || 0), 0)
  const savings = original - price

  async function submit(values) {
    setFormError('')
    const body = { ...values, saleStartsOn: values.saleStartsOn || null, saleEndsOn: values.saleEndsOn || null }
    try {
      if (pkg) await updatePackage(pkg.id, body)
      else await createPackage(body)
      onSaved(pkg ? 'Package updated.' : 'Package added.')
    } catch (error) {
      applyServerFieldErrors(fieldErrorsOf(error), setError)
      setFormError(friendlyError(error))
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogCloseButton onClose={onClose} />
      <Box component="form" onSubmit={handleSubmit(submit)} noValidate>
        <DialogTitle sx={{ pr: 7 }}>{pkg ? 'Edit package' : 'Add a package'}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          {pkg && <Alert severity="info">Changes apply to new sales only. Packages already sold keep their original sessions and price.</Alert>}
          <TextField label="Package name" autoFocus {...field(register, errors, 'name')} />
          <TextField label="Description (optional)" multiline minRows={2} {...field(register, errors, 'description')} />

          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Included services
          </Typography>
          {fields.map((row, index) => (
            <Box key={row.id} sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'minmax(0, 1fr) 84px auto', sm: '1fr 110px auto' }, alignItems: 'start' }}>
              <Controller
                name={`items.${index}.serviceId`}
                control={control}
                render={({ field: f }) => (
                  <TextField
                    select
                    label="Service"
                    value={f.value}
                    onChange={f.onChange}
                    error={Boolean(errors.items?.[index]?.serviceId)}
                    helperText={errors.items?.[index]?.serviceId?.message}
                  >
                    {services.map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name} ({formatMoney(s.price)})
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <TextField
                label="Sessions"
                type="number"
                slotProps={{ htmlInput: { min: 1, max: 100 } }}
                error={Boolean(errors.items?.[index]?.sessions)}
                helperText={errors.items?.[index]?.sessions?.message}
                {...register(`items.${index}.sessions`)}
              />
              {fields.length > 1 ? (
                <IconButton aria-label="Remove service" onClick={() => remove(index)} sx={{ mt: 0.5 }}>
                  ✕
                </IconButton>
              ) : (
                <Box sx={{ width: 40 }} />
              )}
            </Box>
          ))}
          {errors.items?.message && <Alert severity="error">{errors.items.message}</Alert>}
          {errors.items?.root?.message && <Alert severity="error">{errors.items.root.message}</Alert>}
          <Button onClick={() => append({ serviceId: '', sessions: 1 })} sx={{ justifySelf: 'start' }}>
            + Add another service
          </Button>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField label="Package price (₹)" type="number" slotProps={{ htmlInput: { min: 0, step: 1 } }} {...field(register, errors, 'packagePrice')} />
            <TextField label="Valid for (days)" type="number" slotProps={{ htmlInput: { min: 1, max: 1095 } }} {...field(register, errors, 'validityDays')} />
          </Box>
          <Alert severity={savings < 0 ? 'error' : 'success'} icon={false}>
            Services total {formatMoney(original)} · Package price {formatMoney(price)} ·{' '}
            {savings < 0 ? 'Price is higher than the total!' : `Customer saves ${formatMoney(savings)}${original ? ` (${Math.round((savings / original) * 100)}%)` : ''}`}
          </Alert>

          <Typography variant="caption" color="text.secondary">
            Optional: sell this package only between these dates.
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField label="On sale from" type="date" slotProps={{ inputLabel: { shrink: true } }} {...field(register, errors, 'saleStartsOn')} />
            <TextField label="On sale until" type="date" slotProps={{ inputLabel: { shrink: true } }} {...field(register, errors, 'saleEndsOn')} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save package'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
