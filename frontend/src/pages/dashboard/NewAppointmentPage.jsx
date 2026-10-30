import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { fieldErrorsOf, friendlyError } from '../../api/client'
import { createBooking, listBookingSlots, listServices, listStaff } from '../../api/salonApi'
import { useAuth } from '../../auth/AuthContext'
import SelectBox from '../../components/SelectBox'
import { NAME_ERROR, NAME_PATTERN } from '../../utils/validators'

// Aaj ki tarikh "YYYY-MM-DD" (local). toISOString UTC deta hai, isliye khud banate hain.
function dateISO(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const EMPTY = { customerName: '', customerPhone: '', serviceId: '', staffId: '', date: dateISO(), startTime: '', note: '' }

// Naya appointment banane ka page (Dashboard ke "New appointment" button se yahan aate hain).
// Services, staff aur time slots backend se aate hain; save hone par Appointments list khulti hai.
export default function NewAppointmentPage() {
  const { activeSalonId } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})

  const services = useQuery({ queryKey: ['salon', activeSalonId, 'services'], queryFn: listServices })
  const staff = useQuery({ queryKey: ['salon', activeSalonId, 'staff'], queryFn: listStaff })
  const serviceList = (services.data?.services ?? []).filter((s) => s.active)
  // Jis staff ne kuch services chuni hon wo sirf unhi ke liye dikhe; khaali list = sab kar sakta hai
  const staffList = (staff.data?.staff ?? []).filter((s) => s.active && (!values.serviceId || !s.serviceIds.length || s.serviceIds.includes(values.serviceId)))

  const canLoadSlots = Boolean(values.serviceId && values.date && values.date >= dateISO())
  const slots = useQuery({
    queryKey: ['salon', activeSalonId, 'slots', values.date, values.serviceId, values.staffId],
    queryFn: () => listBookingSlots(values),
    enabled: canLoadSlots,
  })
  const freeSlots = (slots.data?.slots ?? []).filter((s) => s.available)

  const save = useMutation({
    mutationFn: createBooking,
    onSuccess: ({ booking }) => {
      queryClient.invalidateQueries({ queryKey: ['salon', activeSalonId] })
      navigate('/appointments', { state: { created: { name: booking.customerName, date: booking.date, time: booking.startTime } } })
    },
    onError: (error) => {
      setErrors(fieldErrorsOf(error))
      // Slot kisi aur ne le liya ho to taaza list mangao
      if (error?.code === 'SLOT_UNAVAILABLE') {
        setValues((v) => ({ ...v, startTime: '' }))
        slots.refetch()
      }
    },
  })

  function setField(name, value) {
    // Service/staff/date badalne par purana time galat ho sakta hai, isliye hata do
    const resets = ['serviceId', 'staffId', 'date'].includes(name)
    setValues((v) => ({ ...v, [name]: value, ...(resets ? { startTime: '' } : {}) }))
    setErrors((e) => ({ ...e, [name]: undefined, ...(resets ? { startTime: undefined } : {}) }))
    save.reset()
  }

  function validate() {
    const found = {}
    const name = values.customerName.trim()
    if (name.length < 2) found.customerName = 'Enter the customer name.'
    else if (!NAME_PATTERN.test(name)) found.customerName = NAME_ERROR
    const phone = values.customerPhone.trim()
    if (/[^\d+]/.test(phone)) found.customerPhone = 'Phone me sirf numbers hon, letters ya symbols nahi.'
    else if (!/^(91)?[6-9]\d{9}$/.test(phone)) found.customerPhone = 'Enter a 10 digit mobile number.'
    if (!values.serviceId) found.serviceId = 'Choose a service.'
    if (!values.date) found.date = 'Choose a date.'
    else if (values.date < dateISO()) found.date = 'The date cannot be in the past.'
    if (!values.startTime) found.startTime = 'Choose an available time.'
    return found
  }

  // Field chhodte hi (blur) sirf usi field ko check karo
  function checkField(name) {
    const message = validate()[name]
    setErrors((e) => ({ ...e, [name]: message }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (save.isPending) return // double click se do booking nahi
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return
    save.mutate({
      customerName: values.customerName.trim(),
      customerPhone: values.customerPhone.trim(),
      serviceId: values.serviceId,
      ...(values.staffId ? { staffId: values.staffId } : {}),
      date: values.date,
      startTime: values.startTime,
      note: values.note.trim(),
    })
  }

  const cls = (name) => (errors[name] ? 'gl-field gl-field--error' : 'gl-field')
  const loadError = services.isError ? friendlyError(services.error) : staff.isError ? friendlyError(staff.error) : ''
  const formError = save.isError && Object.keys(fieldErrorsOf(save.error)).length === 0 ? friendlyError(save.error) : ''

  let slotHint = 'Choose a service and a date to see available times.'
  if (slots.isFetching) slotHint = 'Loading available times...'
  else if (slots.isError) slotHint = friendlyError(slots.error)
  else if (canLoadSlots) slotHint = freeSlots.length === 0 ? 'No free times on this day. Try another date or staff member.' : ''

  return (
    <div className="gl-dashboard">
      <section className="gl-card gl-panel gl-fade-up" style={{ maxWidth: '100%' }} aria-labelledby="gl-new-appt-title">
        <div className="gl-panel__head">
          <h3 id="gl-new-appt-title">New appointment</h3>
        </div>
        {loadError && (
          <p className="gl-field__error" role="alert">
            {loadError}
          </p>
        )}
        <form className="gl-form" onSubmit={handleSubmit} noValidate>
          <div className={cls('customerName')}>
            <label htmlFor="appt-customer">Customer name</label>
            <input id="appt-customer" className="gl-input" onBlur={() => checkField('customerName')} value={values.customerName} onChange={(e) => setField('customerName', e.target.value)} maxLength={100} autoComplete="off" placeholder="e.g. Priya Sharma" aria-invalid={Boolean(errors.customerName)} />
            {errors.customerName && <p className="gl-field__error">{errors.customerName}</p>}
          </div>

          <div className={cls('customerPhone')}>
            <label htmlFor="appt-phone">Phone number</label>
            <input id="appt-phone" className="gl-input" onBlur={() => checkField('customerPhone')} type="tel" inputMode="numeric" value={values.customerPhone} onChange={(e) => setField('customerPhone', e.target.value)} maxLength={13} autoComplete="off" placeholder="10 digit mobile number" aria-invalid={Boolean(errors.customerPhone)} />
            {errors.customerPhone && <p className="gl-field__error">{errors.customerPhone}</p>}
          </div>

          <div className={cls('serviceId')}>
            <label htmlFor="appt-service">Service</label>
            <SelectBox
              id="appt-service"
              value={values.serviceId}
              onChange={(e) => setField('serviceId', e.target.value)}
              disabled={services.isPending}
              error={Boolean(errors.serviceId)}
              options={[{ value: '', label: services.isPending ? 'Loading services...' : 'Select a service' }, ...serviceList.map((s) => ({ value: s.id, label: `${s.name} · ${s.durationMin} min · ₹${s.price}` }))]}
            />
            {!services.isPending && serviceList.length === 0 && <p className="gl-field__hint">No active services yet. Add one on the Services page first.</p>}
            {(errors.serviceId || errors.serviceIds) && <p className="gl-field__error">{errors.serviceId || errors.serviceIds}</p>}
          </div>

          <div className={cls('staffId')}>
            <label htmlFor="appt-staff">Staff member (optional)</label>
            <SelectBox
              id="appt-staff"
              value={values.staffId}
              onChange={(e) => setField('staffId', e.target.value)}
              disabled={staff.isPending}
              error={Boolean(errors.staffId)}
              options={[{ value: '', label: staff.isPending ? 'Loading staff...' : 'Any available staff' }, ...staffList.map((s) => ({ value: s.id, label: s.title ? `${s.name} · ${s.title}` : s.name }))]}
            />
            {errors.staffId && <p className="gl-field__error">{errors.staffId}</p>}
          </div>

          <div className="gl-form__row">
            <div className={cls('date')}>
              <label htmlFor="appt-date">Date</label>
              <input id="appt-date" type="date" className="gl-input" min={dateISO()} max={dateISO(30)} value={values.date} onChange={(e) => setField('date', e.target.value)} aria-invalid={Boolean(errors.date)} />
              {errors.date && <p className="gl-field__error">{errors.date}</p>}
            </div>
            <div className={cls('startTime')}>
              <label htmlFor="appt-time">Available time</label>
              <SelectBox
                id="appt-time"
                value={values.startTime}
                onChange={(e) => setField('startTime', e.target.value)}
                disabled={!canLoadSlots || slots.isFetching || freeSlots.length === 0}
                error={Boolean(errors.startTime)}
                options={[{ value: '', label: freeSlots.length ? 'Select a time' : '-' }, ...freeSlots.map((s) => ({ value: s.time, label: s.time }))]}
              />
              {errors.startTime ? <p className="gl-field__error">{errors.startTime}</p> : slotHint && <p className="gl-field__hint">{slotHint}</p>}
            </div>
          </div>

          <div className="gl-field">
            <label htmlFor="appt-notes">Notes (optional)</label>
            <textarea id="appt-notes" className="gl-input gl-textarea" rows={3} maxLength={300} value={values.note} onChange={(e) => setField('note', e.target.value)} placeholder="Allergies, preferences..." />
            <p className="gl-field__hint">{values.note.length}/300</p>
          </div>

          <p className="gl-form__intro">This is saved as a new request (pending). Confirm it from the Appointments list.</p>
          {formError && (
            <p className="gl-field__error" role="alert">
              {formError}
            </p>
          )}

          <div className="gl-form__actions">
            <button type="button" className="gl-btn gl-btn--ghost" onClick={() => navigate(-1)} disabled={save.isPending}>
              Cancel
            </button>
            <button type="submit" className="gl-btn gl-btn--gold" disabled={save.isPending} aria-busy={save.isPending}>
              {save.isPending ? 'Saving...' : 'Book appointment'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
