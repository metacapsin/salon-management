import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Box, Button, Chip, MenuItem, Snackbar, TextField, Typography } from '@mui/material'
import { fieldErrorsOf, friendlyError } from '../../api/client'
import CityAutocomplete from '../../components/CityAutocomplete'
import { stateOfCity } from '../../data/indianCities'
import { field } from '../../utils/muiForm'
import { getPosition } from '../../utils/geo'
import { applyServerFieldErrors, FACILITIES, salonSchema, slugify } from '../../utils/formSchemas'

// Salon ki basic details. Naya salon banate waqt (mode="create") slug naam se apne aap bhar jaata hai.
// Props: initial, onSubmit(values), submitLabel, readOnly, mode, showSettings
// Settings page: section ('info' | 'address' | 'booking') sirf wahi hissa dikhata he, baaki chhupa deta he (form ek hi rehta he,
// isliye ek Save sab hisse save karta he). onDirtyChange(bool) = unsaved badlav ki khabar, onErrorSection(section) = galti wale hisse par le jaao.
const FIELD_SECTION = { name: 'info', slug: 'info', ownerName: 'info', phone: 'info', about: 'info', audience: 'info', facilities: 'info', timezone: 'info', area: 'address', line1: 'address', city: 'address', state: 'address', pincode: 'address', lat: 'address', lng: 'address', receptionDiscountLimitPercent: 'booking' }

export default function SalonForm({ initial, onSubmit, submitLabel, readOnly = false, mode = 'edit', section, onDirtyChange, onErrorSection }) {
  const [formError, setFormError] = useState('')
  const [saved, setSaved] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting, dirtyFields, isDirty },
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
      reset(values) // ab ye saved haal he: unsaved badlav ka nishaan hat jaye
      setSaved(true)
    } catch (error) {
      applyServerFieldErrors(fieldErrorsOf(error), setError)
      setFormError(friendlyError(error))
    }
  }

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  // Galti kisi chhupe hisse me ho to wahan le jao, warna user ko pata hi nahi chalega ki save kyun nahi hua
  function invalid(errs) {
    const first = Object.keys(errs).find((k) => FIELD_SECTION[k])
    if (first) {
      onErrorSection?.(FIELD_SECTION[first])
      setFormError('Some fields need your attention. Please fix the highlighted fields and save again.')
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
    <Box component="form" onSubmit={handleSubmit(submit, invalid)} noValidate sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, alignItems: 'start', '& > .full': { gridColumn: '1 / -1' }, '& .MuiInputBase-input': { fontSize: '0.875rem', py: 1 }, ...(section && { [`& [data-section]:not([data-section="${section}"])`]: { display: 'none' } }) }}>
      {formError && <Alert className="full" severity="error">{formError}</Alert>}
      <TextField
        size="small"
        label="Salon name"
        data-section="info"
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
        data-section="info"
        disabled={readOnly}
        {...field(register, errors, 'slug')}
        helperText={errors.slug?.message ?? 'Lowercase letters, digits and hyphens. Used in your public booking link.'}
        slotProps={{ htmlInput: { autoCapitalize: 'none', spellCheck: false } }}
      />
      <TextField size="small" label="Owner name" data-section="info" disabled={readOnly} {...field(register, errors, 'ownerName')} />
      <TextField size="small" label="Contact number" type="tel" data-section="info" disabled={readOnly} {...field(register, errors, 'phone')} />
      <TextField
        size="small"
        className="full"
        data-section="info"
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
          <TextField size="small" select label="Salon is for" data-section="info" disabled={readOnly} value={f.value} onChange={f.onChange}>
            <MenuItem value="unisex">Men and women</MenuItem>
            <MenuItem value="women">Women</MenuItem>
            <MenuItem value="men">Men</MenuItem>
          </TextField>
        )}
      />
      <TextField
        size="small"
        label="Area / locality"
        data-section="address"
        disabled={readOnly}
        {...field(register, errors, 'area')}
        helperText={errors.area?.message ?? 'For example Rohini or Bandra West. Customers find your salon by this.'}
      />
      <TextField size="small" className="full" label="Address" data-section="address" disabled={readOnly} {...field(register, errors, 'line1')} />
      <Box className="full" data-section="address" sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
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
      <Box className="full" data-section="address">
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
      <Box className="full" data-section="info">
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
        data-section="info"
        {...field(register, errors, 'timezone')}
        helperText={errors.timezone?.message ?? 'All salons use Asia/Kolkata in this version.'}
        slotProps={{ htmlInput: { readOnly: true } }}
      />
      {mode === 'edit' && (
        <TextField
        size="small"
          label="Reception discount limit (%)"
          data-section="booking"
          type="number"
          disabled={readOnly}
          {...field(register, errors, 'receptionDiscountLimitPercent')}
          helperText={errors.receptionDiscountLimitPercent?.message ?? 'Receptionists can give up to this discount. Higher needs a Manager or Owner.'}
          slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
        />
      )}
      {saved && !section && <Alert className="full" severity="success">Saved.</Alert>}
      {!readOnly && !section && (
        <Box className="full">
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
        </Box>
      )}
      {!readOnly && section && (
        <Box
          className="full"
          sx={{ position: 'sticky', bottom: 0, zIndex: 2, mt: 1, mx: { xs: -2, md: -2.5 }, mb: { xs: -2, md: -2.5 }, px: { xs: 2, md: 2.5 }, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1.5, bgcolor: '#fffdf8', borderTop: '1px solid #eadfd3', borderRadius: '0 0 12px 12px' }}
        >
          <Typography variant="body2" sx={{ color: isDirty ? '#a9801f' : 'text.secondary', fontWeight: isDirty ? 700 : 400, flexGrow: 1 }}>
            {isDirty ? '● You have unsaved changes' : 'All changes saved'}
          </Typography>
          <Button variant="text" onClick={() => reset()} disabled={!isDirty || isSubmitting} sx={{ textTransform: 'none' }}>
            Discard
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting || !isDirty} sx={{ textTransform: 'none', fontWeight: 700, px: 3 }}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
        </Box>
      )}
      {section && (
        <Snackbar open={saved} autoHideDuration={3000} onClose={() => setSaved(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity="success" variant="filled" onClose={() => setSaved(false)}>
            Settings saved.
          </Alert>
        </Snackbar>
      )}
    </Box>
  )
}
