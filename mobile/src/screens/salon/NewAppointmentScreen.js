import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createBooking, fetchServices, fetchSlots, fetchStaff } from '../../api/salonApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import Button from '../../components/Button'
import { Card, Screen, SectionTitle } from '../../components/Screen'
import TextField from '../../components/TextField'
import { COLORS } from '../../config/theme'
import { formatMoney } from '../../utils/formatMoney'

const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Today + the next 30 days (the server accepts bookings only inside this window).
function nextDays(count = 31) {
  const list = []
  for (let i = 0; i < count; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    list.push({
      value: iso(d),
      top: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short' }),
      bottom: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    })
  }
  return list
}

// New appointment made by the salon team (Owner / Manager / Receptionist). The server decides which times are free
// (salon hours, staff shifts, existing appointments) and checks the chosen time again when saving.
export default function NewAppointmentScreen({ navigation }) {
  const { activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const days = useMemo(() => nextDays(), [])

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [date, setDate] = useState(days[0].value)
  const [startTime, setStartTime] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')

  const services = useQuery({ queryKey: ['services', activeSalonId, false], queryFn: () => fetchServices({ includeInactive: false }), staleTime: 0 })
  const staff = useQuery({ queryKey: ['staff', activeSalonId, false], queryFn: () => fetchStaff({ includeInactive: false }), staleTime: 0 })

  // A staff member who ticked some services appears only for those; an empty list means "does everything".
  const staffList = (staff.data ?? []).filter((s) => !serviceId || !s.serviceIds.length || s.serviceIds.map(String).includes(serviceId))
  const chosenService = (services.data ?? []).find((s) => s.id === serviceId)

  const slots = useQuery({
    queryKey: ['slots', activeSalonId, date, serviceId, staffId],
    queryFn: () => fetchSlots({ date, serviceId, staffId: staffId || undefined }),
    enabled: Boolean(serviceId && date),
    staleTime: 0,
    retry: false,
  })
  const freeSlots = (slots.data ?? []).filter((s) => s.available)

  const save = useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', activeSalonId] })
      queryClient.invalidateQueries({ queryKey: ['pending-appointments', activeSalonId] })
      navigation.goBack()
    },
    onError: (error) => {
      setErrors(error?.fieldErrors ?? {})
      if (error?.code === 'SLOT_UNAVAILABLE') {
        // Someone else took that time: forget it and show the fresh list.
        setStartTime('')
        slots.refetch()
        setFormError('That time was just taken. Please choose another time.')
      } else {
        setFormError(error?.fieldErrors && Object.keys(error.fieldErrors).length ? 'Please check the highlighted fields.' : friendlyError(error))
      }
    },
  })

  // An error message goes away as soon as the person changes that field.
  const clear = (...keys) => setErrors((e) => ({ ...e, ...Object.fromEntries(keys.map((k) => [k, undefined])) }))

  // Changing service, staff or day makes an old time wrong, so it is cleared.
  const pickService = (id) => {
    setServiceId(id)
    setStaffId('')
    setStartTime('')
    clear('serviceId', 'startTime')
  }
  const pickStaff = (id) => {
    setStaffId(id)
    setStartTime('')
    clear('startTime')
  }
  const pickDate = (value) => {
    setDate(value)
    setStartTime('')
    clear('startTime')
  }
  const pickTime = (time) => {
    setStartTime(time)
    clear('startTime')
  }

  function submit() {
    setFormError('')
    const found = {}
    const digits = phone.trim()
    if (name.trim().length < 2) found.customerName = 'Enter the customer name.'
    if (!/^(91)?[6-9]\d{9}$/.test(digits)) found.customerPhone = 'Enter a 10 digit mobile number.'
    if (!serviceId) found.serviceId = 'Choose a service.'
    if (!startTime) found.startTime = 'Choose an available time.'
    setErrors(found)
    if (Object.keys(found).length) return
    save.mutate({
      customerName: name.trim(),
      customerPhone: digits,
      serviceId,
      ...(staffId ? { staffId } : {}),
      date,
      startTime,
      note: note.trim(),
    })
  }

  let slotHint = ''
  if (!serviceId) slotHint = 'Choose a service to see the free times.'
  else if (slots.isFetching) slotHint = 'Loading free times…'
  else if (slots.isError) slotHint = friendlyError(slots.error)
  else if (freeSlots.length === 0) slotHint = 'No free time on this day. Try another day or another staff member.'

  return (
    <Screen>
      <Card>
        {formError ? <Text style={styles.banner}>{formError}</Text> : null}
        <TextField label="Customer name" value={name} onChangeText={(v) => { setName(v); clear('customerName') }} error={errors.customerName} placeholder="e.g. Priya Sharma" maxLength={100} />
        <TextField label="Mobile number" value={phone} onChangeText={(v) => { setPhone(v.replace(/[^\d]/g, '').slice(0, 12)); clear('customerPhone') }} error={errors.customerPhone} keyboardType="number-pad" placeholder="10 digit mobile number" />
      </Card>

      <SectionTitle>Service</SectionTitle>
      {services.isLoading ? <ActivityIndicator color={COLORS.brown} /> : null}
      {services.isError ? <Text style={styles.error}>{friendlyError(services.error)}</Text> : null}
      {!services.isLoading && (services.data ?? []).length === 0 ? <Text style={styles.muted}>No service yet. Add a service first.</Text> : null}
      <View style={styles.wrap}>
        {(services.data ?? []).map((s) => (
          <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`Service ${s.name}`} onPress={() => pickService(s.id)} style={[styles.chip, serviceId === s.id && styles.chipOn]}>
            <Text style={[styles.chipText, serviceId === s.id && styles.chipTextOn]}>
              {s.name} · {formatMoney(s.price)}
            </Text>
          </Pressable>
        ))}
      </View>
      {errors.serviceId ? <Text style={styles.error}>{errors.serviceId}</Text> : null}
      {chosenService ? <Text style={styles.muted}>{chosenService.durationMin} minutes</Text> : null}

      {serviceId && staffList.length > 0 ? (
        <>
          <SectionTitle>Staff (optional)</SectionTitle>
          <View style={styles.wrap}>
            {[{ id: '', name: 'Anyone' }, ...staffList].map((s) => (
              <Pressable key={s.id || 'any'} accessibilityRole="button" accessibilityLabel={`Staff ${s.name}`} onPress={() => pickStaff(s.id)} style={[styles.chip, staffId === s.id && styles.chipOn]}>
                <Text style={[styles.chipText, staffId === s.id && styles.chipTextOn]}>{s.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <SectionTitle>Day</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysScroll} contentContainerStyle={styles.days}>
        {days.map((d) => (
          <Pressable key={d.value} accessibilityRole="button" accessibilityLabel={`Day ${d.value}`} onPress={() => pickDate(d.value)} style={[styles.day, date === d.value && styles.chipOn]}>
            <Text style={[styles.dayTop, date === d.value && styles.chipTextOn]}>{d.top}</Text>
            <Text style={[styles.dayBottom, date === d.value && styles.chipTextOn]}>{d.bottom}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <SectionTitle>Time</SectionTitle>
      {slotHint ? <Text style={styles.muted}>{slotHint}</Text> : null}
      {slots.isFetching && serviceId ? <ActivityIndicator color={COLORS.brown} style={{ marginBottom: 8 }} /> : null}
      <View style={styles.wrap}>
        {freeSlots.map((s) => (
          <Pressable key={s.time} accessibilityRole="button" accessibilityLabel={`Time ${s.time}`} onPress={() => pickTime(s.time)} style={[styles.slot, startTime === s.time && styles.chipOn]}>
            <Text style={[styles.chipText, startTime === s.time && styles.chipTextOn]}>{s.time}</Text>
          </Pressable>
        ))}
      </View>
      {errors.startTime ? <Text style={styles.error}>{errors.startTime}</Text> : null}

      <Card style={{ marginTop: 12 }}>
        <TextField label="Note (optional)" value={note} onChangeText={setNote} error={errors.note} multiline maxLength={300} style={styles.multiline} />
        <Button title="Save appointment" onPress={submit} loading={save.isPending} />
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  banner: { color: COLORS.error, backgroundColor: '#fdecea', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 14 },
  muted: { fontSize: 13, color: COLORS.muted, marginBottom: 8 },
  error: { color: COLORS.error, fontSize: 13, marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff', justifyContent: 'center' },
  chipOn: { backgroundColor: COLORS.brown, borderColor: COLORS.brown },
  chipText: { fontSize: 14, color: COLORS.ink },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  slot: { minHeight: 44, minWidth: 76, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  daysScroll: { flexGrow: 0, flexShrink: 0, marginHorizontal: -16, marginBottom: 8 },
  days: { paddingHorizontal: 16, gap: 8, paddingVertical: 2 },
  day: { minWidth: 72, minHeight: 58, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  dayTop: { fontSize: 13, color: COLORS.muted, fontWeight: '600' },
  dayBottom: { fontSize: 14, color: COLORS.ink, fontWeight: '700', marginTop: 2 },
  multiline: { minHeight: 70, textAlignVertical: 'top', paddingTop: 12 },
})
