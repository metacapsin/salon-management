import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Box, Button, Chip, MenuItem, TextField, Typography } from '@mui/material'
import { fieldErrorsOf, friendlyError } from '../../api/client'
import CityAutocomplete from '../../components/CityAutocomplete'
import { stateOfCity } from '../../data/indianCities'
import { field } from '../../utils/muiForm'
import { getPosition } from '../../utils/geo'
import { applyServerFieldErrors, FACILITIES, salonSchema, slugify } from '../../utils/formSchemas'

// Salon ki basic details. Naya salon banate waqt (mode="create") slug naam se apne aap bhar jaata hai.
// Props: initial, onSubmit(values), submitLabel, readOnly, mode, showSettings
export default function SalonForm({ initial, onSubmit, submitLabel, readOnly = false, mode = 'edit' }) {
  const [formError, setFormError] = useState('')
  const [saved, setSaved] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    watch,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm({
    resolver: zodResolver(salonSchema),
    defaultValues: {
      name: initial?.name ?? '',
      slug: initial?.slug ?? '',
      ownerName: initial?.ownerContact?.name ?? '',
      phone: initial?.ownerContact?.phone ?? '',
      about: initial?.about ?? '',
      audience: initial?.audience ?? 'unisex',
      facilities: initial?.facilities ?? [],
      lat: initial?.address?.location?.lat?.toString() ?? '',
      lng: initial?.address?.location?.lng?.toString() ?? '',
      line1: initial?.address?.line1 ?? '',
      city: initial?.address?.city ?? '',
      area: initial?.address?.area ?? '',
      state: initial?.address?.state ?? '',
      pincode: initial?.address?.pincode ?? '',
      timezone: initial?.timezone ?? 'Asia/Kolkata',
      receptionDiscountLimitPercent: initial?.settings?.receptionDiscountLimitPercent ?? 10,
    },
  })

  async function submit(values) {
    setFormError('')
    setSaved(false)
    try {
      await onSubmit(values)
      setSaved(true)
    } catch (error) {
      applyServerFieldErrors(fieldErrorsOf(error), setError)
      setFormError(friendlyError(error))
    }
  }

  const nameField = field(register, errors, 'name')
  const [locating, setLocating] = useState(false)

  async function useMyLocation() {
    setLocating(true)
    try {
      const { lat, lng } = await getPosition()
      setValue('lat', lat.toFixed(6), { shouldValidate: true, shouldDirty: true })
      setValue('lng', lng.toFixed(6), { shouldValidate: true, shouldDirty: true })
    } catch {
      setFormError('Could not read your location. Allow location access or type the latitude and longitude.')
    } finally {
      setLocating(false)
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit(submit)} noValidate sx={{ display: 'grid', gap: 1.5, maxWidth: 640, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, alignItems: 'start', '& > .full': { gridColumn: '1 / -1' }, '& .MuiInputBase-input': { fontSize: '0.875rem', py: 1 } }}>
      {formError && <Alert className="full" severity="error">{formError}</Alert>}
      <TextField
        size="small"
        label="Salon name"
        disabled={readOnly}
        {...nameField}
        onChange={(e) => {
          nameField.onChange(e)
          // Slug tabhi apne aap badlo jab user ne use khud na chheda ho
          if (mode === 'create' && !dirtyFields.slug) setValue('slug', slugify(e.target.value), { shouldValidate: false })
        }}
      />
      <TextField
        size="small"
        label="Booking page address"
        disabled={readOnly}
        {...field(register, errors, 'slug')}
        helperText={errors.slug?.message ?? 'Lowercase letters, digits and hyphens. Used in your public booking link.'}
        slotProps={{ htmlInput: { autoCapitalize: 'none', spellCheck: false } }}
      />
      <TextField size="small" label="Owner name" disabled={readOnly} {...field(register, errors, 'ownerName')} />
      <TextField size="small" label="Contact number" type="tel" disabled={readOnly} {...field(register, errors, 'phone')} />
      <TextField
        size="small"
        className="full"
        label="About the salon"
        multiline
        minRows={2}
        disabled={readOnly}
        {...field(register, errors, 'about')}
        helperText={errors.about?.message ?? 'A short line customers see on your salon card (up to 500 characters).'}
      />
      <Controller
        name="audience"
        control={control}
        render={({ field: f }) => (
          <TextField size="small" select label="Salon is for" disabled={readOnly} value={f.value} onChange={f.onChange}>
            <MenuItem value="unisex">Men and women</MenuItem>
            <MenuItem value="women">Women</MenuItem>
            <MenuItem value="men">Men</MenuItem>
          </TextField>
        )}
      />
      <TextField
        size="small"
        label="Area / locality"
        disabled={readOnly}
        {...field(register, errors, 'area')}
        helperText={errors.area?.message ?? 'For example Rohini or Bandra West. Customers find your salon by this.'}
      />
      <TextField size="small" className="full" label="Address" disabled={readOnly} {...field(register, errors, 'line1')} />
      <Box className="full" sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
        <Controller
          name="city"
          control={control}
          render={({ field: f }) => (
            <CityAutocomplete
              freeSolo
              label="City"
              disabled={readOnly}
              value={f.value}
              onBlur={f.onBlur}
              error={Boolean(errors.city)}
              helperText={errors.city?.message}
              onChange={(next) => {
                f.onChange(next)
                // Jaana-pehchana shehar chunte hi state apne aap bhar do (agar user ne khud na likha ho)
                const state = stateOfCity(next)
                if (state && !dirtyFields.state) setValue('state', state)
              }}
            />
          )}
        />
        <TextField size="small" label="State" disabled={readOnly} {...field(register, errors, 'state')} />
        <TextField size="small" label="Pincode" disabled={readOnly} {...field(register, errors, 'pincode')} />
      </Box>
      <Box className="full">
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Map location
        </Typography>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr auto' }, alignItems: 'start' }}>
          {/* shrink: button se value set hone par label value ke upar na chadhe */}
          <TextField size="small" label="Latitude" disabled={readOnly} {...field(register, errors, 'lat')} slotProps={{ inputLabel: { shrink: Boolean(watch('lat')) || undefined } }} />
          <TextField size="small" label="Longitude" disabled={readOnly} {...field(register, errors, 'lng')} slotProps={{ inputLabel: { shrink: Boolean(watch('lng')) || undefined } }} />
          {!readOnly && (
            <Button variant="outlined" onClick={useMyLocation} disabled={locating} sx={{ height: 40 }}>
              {locating ? 'Locating…' : 'Use my location'}
            </Button>
          )}
        </Box>
        <Typography variant="caption" color="text.secondary">
          Stand inside the salon and press the button. Customers see your salon on the map with this.
        </Typography>
      </Box>
      <Box className="full">
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Facilities
        </Typography>
        <Controller
          name="facilities"
          control={control}
          render={({ field: f }) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {FACILITIES.map(({ value, label }) => {
                const on = f.value.includes(value)
                return (
                  <Chip
                    key={value}
                    label={label}
                    clickable={!readOnly}
                    color={on ? 'primary' : 'default'}
                    variant={on ? 'filled' : 'outlined'}
                    onClick={readOnly ? undefined : () => f.onChange(on ? f.value.filter((x) => x !== value) : [...f.value, value])}
                  />
                )
              })}
            </Box>
          )}
        />
      </Box>
      {/* Version 1 me ek hi timezone (SRS section 3). readOnly rakha hai, disabled nahi, taaki value form ke saath jaaye. */}
      <TextField
        size="small"
        label="Timezone"
        {...field(register, errors, 'timezone')}
        helperText={errors.timezone?.message ?? 'All salons use Asia/Kolkata in this version.'}
        slotProps={{ htmlInput: { readOnly: true } }}
      />
      {mode === 'edit' && (
        <TextField
        size="small"
          label="Reception discount limit (%)"
          type="number"
          disabled={readOnly}
          {...field(register, errors, 'receptionDiscountLimitPercent')}
          helperText={errors.receptionDiscountLimitPercent?.message ?? 'Receptionists can give up to this discount. Higher needs a Manager or Owner.'}
          slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
        />
      )}
      {saved && <Alert className="full" severity="success">Saved.</Alert>}
      {!readOnly && (
        <Box className="full">
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
        </Box>
      )}
    </Box>
  )
}
