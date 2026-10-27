import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createBooking, fetchSlots } from '../../api/publicApi'
import { ApiError, friendlyError } from '../../api/client'
import Button from '../../components/Button'
import { Ionicons } from '@expo/vector-icons'
import { ErrorBanner } from '../../components/States'
import { COLORS, FONT, RADIUS } from '../../config/theme'
import { formatDate, formatMoney } from '../../utils/formatMoney'
import { todayString } from '../../utils/dates'
import { offerText } from './SalonDetailScreen'

const DAYS_AHEAD = 14

// Same rule as the server (modules/offers/pricing.js). Only a preview: the server works out the real amount.
function discountFor(offer, services) {
  const ids = new Set(offer.serviceIds ?? [])
  const base = services.filter((s) => ids.size === 0 || ids.has(s.id)).reduce((sum, s) => sum + s.price, 0)
  if (base === 0) return 0
  const raw = offer.discountType === 'percent' ? Math.floor((base * offer.discountValue) / 100) : offer.discountValue
  return Math.min(raw, base)
}

function nextDays() {
  const [y, m, d] = todayString().split('-').map(Number)
  return Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const day = new Date(y, m - 1, d + i)
    const pad = (n) => String(n).padStart(2, '0')
    return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
  })
}

function Chip({ label, selected, disabled, onPress }) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} accessibilityRole="button" accessibilityState={{ selected, disabled }} style={[styles.chip, selected && styles.chipOn, disabled && styles.chipOff]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  )
}

// Book the chosen services: where (salon/home), day, time, offer, note. The server checks the slot, prices and offer again.
export default function BookScreen({ route, navigation }) {
  const { salon, serviceIds } = route.params
  const insets = useSafeAreaInsets()
  const services = useMemo(() => salon.services.filter((s) => serviceIds.includes(s.id)), [salon, serviceIds])
  const subtotal = services.reduce((sum, s) => sum + s.price, 0)
  const duration = services.reduce((sum, s) => sum + s.durationMin, 0)

  const modes = [
    ...(services.every((s) => s.atSalon) && salon.serviceModes?.salonVisit !== false ? [['salon', 'At the salon']] : []),
    ...(services.every((s) => s.atHome) && salon.serviceModes?.homeService ? [['home', 'At home']] : []),
  ]
  const offers = useMemo(() => (salon.offers ?? []).map((o) => ({ ...o, discount: discountFor(o, services) })).filter((o) => o.discount > 0), [salon, services])
  const bestOffer = offers.reduce((best, o) => (!best || o.discount > best.discount ? o : best), null)

  const days = useMemo(nextDays, [])
  const [mode, setMode] = useState(modes[0]?.[0] ?? null)
  const [date, setDate] = useState(days[0])
  const [time, setTime] = useState(null)
  const [offerId, setOfferId] = useState(bestOffer?.id ?? null)
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  const queryClient = useQueryClient()
  const slots = useQuery({ queryKey: ['public', 'slots', salon.id, date, duration], queryFn: () => fetchSlots(salon.id, { date, duration }) })
  const offer = offers.find((o) => o.id === offerId) ?? null
  const total = subtotal - (offer?.discount ?? 0)

  const book = useMutation({
    mutationFn: () => createBooking(salon.id, { mode, date, startTime: time, serviceIds, address: mode === 'home' ? address.trim() : '', note: note.trim(), ...(offerId ? { offerId } : {}) }),
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ['public', 'my-bookings'] })
      setDone(booking)
    },
    onError: (e) => {
      setError(friendlyError(e))
      if (e instanceof ApiError && e.code === 'SLOT_UNAVAILABLE') {
        setTime(null)
        slots.refetch()
      }
    },
  })

  function submit() {
    setError('')
    if (!time) return setError('Choose a time.')
    if (mode === 'home' && address.trim().length < 8) return setError('Enter your full address for home service.')
    book.mutate()
  }

  if (done) {
    return (
      <View style={styles.doneWrap}>
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark" size={40} color={COLORS.espresso} />
        </View>
        <Text style={styles.doneTitle}>Request sent</Text>
        <Text style={styles.doneText}>
          {done.salonName} will confirm your appointment for {formatDate(done.date)} at {done.startTime}.
        </Text>
        <Text style={styles.doneText}>Total: {formatMoney(done.total)}{done.offer ? ` (saved ${formatMoney(done.offer.discount)} with ${done.offer.title})` : ''}</Text>
        <Button title="Back to salons" icon="home-outline" onPress={() => navigation.popToTop()} />
      </View>
    )
  }

  if (modes.length === 0) {
    return (
      <View style={styles.doneWrap}>
        <Text style={styles.doneText}>These services cannot be booked together (some are only at the salon, others only at home). Go back and choose again.</Text>
        <Button title="Go back" onPress={() => navigation.goBack()} />
      </View>
    )
  }

  const availableSlots = (slots.data ?? []).filter((s) => s.available)

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]} keyboardShouldPersistTaps="handled">
      <Text style={styles.salon}>{salon.name}</Text>
      <Text style={styles.muted}>{services.map((s) => s.name).join(', ')} · {duration} min</Text>

      {modes.length > 1 ? (
        <>
          <Text style={styles.section}>Where</Text>
          <View style={styles.wrap}>
            {modes.map(([key, label]) => <Chip key={key} label={label} selected={mode === key} onPress={() => setMode(key)} />)}
          </View>
        </>
      ) : null}
      {mode === 'home' ? (
        <TextInput value={address} onChangeText={setAddress} placeholder="Your full address" placeholderTextColor="#a8978a" accessibilityLabel="Your full address" multiline style={[styles.input, { minHeight: 72 }]} />
      ) : null}

      <Text style={styles.section}>Day</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {days.map((d) => <Chip key={d} label={formatDate(d)} selected={date === d} onPress={() => { setDate(d); setTime(null) }} />)}
      </ScrollView>

      <Text style={styles.section}>Time</Text>
      {slots.isLoading ? <ActivityIndicator color={COLORS.brown} /> : null}
      {slots.isError ? <Text style={styles.error}>{friendlyError(slots.error)}</Text> : null}
      {slots.data && availableSlots.length === 0 ? <Text style={styles.muted}>No times are free on this day. Try another day.</Text> : null}
      <View style={styles.wrap}>
        {availableSlots.map((s) => <Chip key={s.time} label={s.time} selected={time === s.time} onPress={() => setTime(s.time)} />)}
      </View>

      {offers.length > 0 ? (
        <>
          <Text style={styles.section}>Offer</Text>
          <View style={styles.wrap}>
            <Chip label="No offer" selected={offerId === null} onPress={() => setOfferId(null)} />
            {offers.map((o) => <Chip key={o.id} label={`${o.title} · ${offerText(o)}`} selected={offerId === o.id} onPress={() => setOfferId(o.id)} />)}
          </View>
        </>
      ) : null}

      <Text style={styles.section}>Note (optional)</Text>
      <TextInput value={note} onChangeText={setNote} placeholder="Anything the salon should know" placeholderTextColor="#a8978a" accessibilityLabel="Note" maxLength={300} style={styles.input} />

      <View style={styles.summary}>
        <Text style={styles.sumLine}>Services  {formatMoney(subtotal)}</Text>
        {offer ? <Text style={styles.sumLine}>Offer  −{formatMoney(offer.discount)}</Text> : null}
        <Text style={styles.sumTotal}>Total  {formatMoney(total)}</Text>
        <Text style={styles.muted}>Pay at the salon. The price is confirmed by the server.</Text>
      </View>

      <ErrorBanner message={error} />
      <Button title="Request appointment" icon="checkmark-circle-outline" onPress={submit} loading={book.isPending} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream },
  content: { padding: 16 },
  salon: { fontSize: 22, fontWeight: '700', color: COLORS.ink, fontFamily: FONT.heading },
  muted: { marginTop: 2, fontSize: 13, color: COLORS.muted },
  section: { marginTop: 20, marginBottom: 8, fontSize: 16, fontWeight: '700', color: COLORS.ink, fontFamily: FONT.heading },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { gap: 8 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.surface },
  chipOn: { backgroundColor: COLORS.espresso, borderColor: COLORS.espresso },
  chipOff: { opacity: 0.4 },
  chipText: { fontSize: 14, color: COLORS.brown, fontWeight: '600' },
  chipTextOn: { color: COLORS.gold },
  input: { minHeight: 48, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: COLORS.ink, marginTop: 8 },
  summary: { marginVertical: 20, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.line, padding: 14, gap: 4 },
  sumLine: { fontSize: 14, color: COLORS.ink },
  sumTotal: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  banner: { backgroundColor: '#fdecea', borderWidth: 1, borderColor: COLORS.error, borderRadius: 10, padding: 12, marginBottom: 12 },
  error: { color: COLORS.error, fontSize: 14 },
  doneWrap: { flex: 1, backgroundColor: COLORS.cream, padding: 20, justifyContent: 'center', gap: 14 },
  doneIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  doneTitle: { textAlign: 'center', fontSize: 26, fontWeight: '700', color: COLORS.success, fontFamily: FONT.heading },
  doneText: { fontSize: 15, color: COLORS.ink, textAlign: 'center' },
})
