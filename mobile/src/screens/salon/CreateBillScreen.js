import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createInvoice, fetchBillableAppointments, previewInvoice } from '../../api/billingApi'
import { fetchOffers, fetchServices } from '../../api/salonApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import Button from '../../components/Button'
import { SwitchRow } from '../../components/Form'
import { Card, Screen, SectionTitle } from '../../components/Screen'
import TextField from '../../components/TextField'
import { COLORS } from '../../config/theme'
import { todayString } from '../../utils/dates'
import { formatPaise } from '../../utils/formatPaise'
import { formatDate } from '../../utils/formatMoney'
import { newRequestKey } from '../../utils/money'

const PHONE_OK = /^\d{10}$/

const offerText = (o) => (o.discountType === 'percent' ? `${o.discountValue}% off` : `₹${o.discountValue} off`)

function Qty({ value, onChange, onRemove, name }) {
  return (
    <View style={styles.qty}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Less ${name}`} onPress={() => onChange(Math.max(1, value - 1))} style={styles.qtyBtn}>
        <Text style={styles.qtyBtnText}>−</Text>
      </Pressable>
      <Text style={styles.qtyValue}>{value}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`More ${name}`} onPress={() => onChange(Math.min(20, value + 1))} style={styles.qtyBtn}>
        <Text style={styles.qtyBtnText}>+</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${name}`} onPress={onRemove} style={styles.qtyBtn}>
        <Text style={[styles.qtyBtnText, { color: COLORS.error }]}>×</Text>
      </Pressable>
    </View>
  )
}

// New bill. This screen only picks WHO, WHAT and HOW MANY. Prices, offer, membership discount and GST all
// come from the server (/invoices/preview), and "Create bill" makes the server do the same maths again.
export default function CreateBillScreen({ navigation }) {
  const { activeSalonId } = useAuth()
  const queryClient = useQueryClient()

  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [bookingId, setBookingId] = useState('')
  const [lines, setLines] = useState([]) // [{ serviceId, name, quantity }]
  const [offerId, setOfferId] = useState('')
  const [applyMembership, setApplyMembership] = useState(true)
  const [submitError, setSubmitError] = useState('')

  const phoneValid = PHONE_OK.test(phone)

  const services = useQuery({ queryKey: ['services', activeSalonId, false], queryFn: () => fetchServices({ includeInactive: false }), staleTime: 0 })
  const offers = useQuery({ queryKey: ['offers', activeSalonId], queryFn: fetchOffers, staleTime: 0 })
  const appointments = useQuery({
    queryKey: ['billable', activeSalonId, phone],
    queryFn: () => fetchBillableAppointments(phone),
    enabled: phoneValid,
    staleTime: 0,
  })

  const today = todayString()
  const runningOffers = (offers.data ?? []).filter((o) => o.active && o.startsOn <= today && o.endsOn >= today)

  // Only ids and quantities go to the server.
  const body = useMemo(() => {
    const b = { applyMembership, lines: lines.map((l) => ({ serviceId: l.serviceId, quantity: l.quantity })) }
    if (bookingId) b.bookingId = bookingId
    else {
      b.customerPhone = phone
      b.customerName = name.trim()
    }
    if (offerId) b.offerId = offerId
    return b
  }, [applyMembership, lines, bookingId, phone, name, offerId])
  const bodyKey = JSON.stringify(body)

  const ready = lines.length > 0 && (bookingId || (phoneValid && name.trim().length > 0))
  const quote = useQuery({
    queryKey: ['bill-preview', activeSalonId, bodyKey],
    queryFn: () => previewInvoice(body),
    enabled: Boolean(ready),
    retry: false,
    staleTime: 0,
  })

  // Same body = same key (a double tap or a retry makes ONE bill). A changed body gets a new key.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const requestKey = useMemo(() => newRequestKey(), [bodyKey])
  const create = useMutation({
    mutationFn: () => createInvoice({ ...body, requestKey }),
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', activeSalonId] })
      queryClient.invalidateQueries({ queryKey: ['billing-summary', activeSalonId] })
      queryClient.invalidateQueries({ queryKey: ['billable', activeSalonId] })
      navigation.replace('InvoiceDetail', { id: invoice.id, number: invoice.invoiceNumber })
    },
    onError: (error) => setSubmitError(friendlyError(error)),
  })

  function changePhone(value) {
    setPhone(value.replace(/\D/g, '').slice(0, 10))
    setBookingId('')
    setLines([])
    setOfferId('')
  }
  function pickAppointment(a) {
    if (!a) {
      setBookingId('')
      return
    }
    setBookingId(a.id)
    setName(a.customerName)
    setLines(a.services.map((s) => ({ serviceId: String(s.serviceId), name: s.name, quantity: 1 })))
  }
  const addService = (s) => setLines((ls) => (ls.some((l) => l.serviceId === s.id) ? ls : [...ls, { serviceId: s.id, name: s.name, quantity: 1 }]))
  const setQty = (id, quantity) => setLines((ls) => ls.map((l) => (l.serviceId === id ? { ...l, quantity } : l)))
  const removeLine = (id) => setLines((ls) => ls.filter((l) => l.serviceId !== id))

  const q = quote.data
  const quoteError = quote.isError ? friendlyError(quote.error) : ''
  const billable = appointments.data ?? []

  return (
    <Screen>
      <Card>
        <TextField label="Customer mobile (10 digits)" value={phone} onChangeText={changePhone} keyboardType="number-pad" maxLength={10} placeholder="9876543210" />
        <TextField label="Customer name" value={name} onChangeText={setName} editable={!bookingId} placeholder="Name" maxLength={100} />
      </Card>

      {phoneValid ? (
        <>
          <SectionTitle>Appointment</SectionTitle>
          {appointments.isLoading ? <ActivityIndicator color={COLORS.brown} /> : null}
          {appointments.isError ? <Text style={styles.error}>{friendlyError(appointments.error)}</Text> : null}
          {!appointments.isLoading && billable.length === 0 ? <Text style={styles.muted}>No appointment is waiting for a bill. You can make a walk-in bill below.</Text> : null}
          {billable.length > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Walk-in, no appointment" onPress={() => pickAppointment(null)} style={[styles.pick, !bookingId && styles.pickOn]}>
              <Text style={styles.pickTitle}>Walk-in (no appointment)</Text>
            </Pressable>
          ) : null}
          {billable.map((a) => (
            <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={`Appointment ${a.date} ${a.startTime}`} onPress={() => pickAppointment(a)} style={[styles.pick, bookingId === a.id && styles.pickOn]}>
              <Text style={styles.pickTitle}>
                {formatDate(a.date)} · {a.startTime} · {a.status}
              </Text>
              <Text style={styles.muted}>{a.services.map((s) => s.name).join(', ')}</Text>
            </Pressable>
          ))}

          <SectionTitle>Services</SectionTitle>
          {lines.length === 0 ? <Text style={styles.muted}>Choose at least one service.</Text> : null}
          {lines.map((l) => (
            <Card key={l.serviceId} style={styles.lineCard}>
              <Text style={styles.lineName}>{l.name}</Text>
              <Qty name={l.name} value={l.quantity} onChange={(n) => setQty(l.serviceId, n)} onRemove={() => removeLine(l.serviceId)} />
            </Card>
          ))}
          {services.isLoading ? <ActivityIndicator color={COLORS.brown} /> : null}
          {services.isError ? (
            <Text style={styles.error}>
              {friendlyError(services.error)} <Text style={styles.retry} onPress={() => services.refetch()}>Try again</Text>
            </Text>
          ) : null}
          {offers.isError ? <Text style={styles.error}>Offers could not be loaded: {friendlyError(offers.error)}</Text> : null}
          <View style={styles.chips}>
            {(services.data ?? [])
              .filter((s) => !lines.some((l) => l.serviceId === s.id))
              .map((s) => (
                <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`Add ${s.name}`} onPress={() => addService(s)} style={styles.chip}>
                  <Text style={styles.chipText}>+ {s.name}</Text>
                </Pressable>
              ))}
          </View>

          {runningOffers.length > 0 ? (
            <>
              <SectionTitle>Offer</SectionTitle>
              <View style={styles.chips}>
                {[{ id: '', title: 'No offer' }, ...runningOffers].map((o) => (
                  <Pressable key={o.id || 'none'} accessibilityRole="button" accessibilityLabel={o.title} onPress={() => setOfferId(o.id)} style={[styles.chip, offerId === o.id && styles.chipOn]}>
                    <Text style={[styles.chipText, offerId === o.id && styles.chipTextOn]}>{o.id ? `${o.title} (${offerText(o)})` : o.title}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Card style={{ marginTop: 12 }}>
            <SwitchRow label="Apply the customer's membership" value={applyMembership} onValueChange={setApplyMembership} hint="The server uses the best active membership, if there is one." />
          </Card>
        </>
      ) : (
        <Text style={styles.muted}>Enter the customer's 10 digit mobile number to start.</Text>
      )}

      {ready ? (
        <>
          <SectionTitle>Bill</SectionTitle>
          {quote.isFetching && !q ? <ActivityIndicator color={COLORS.brown} /> : null}
          {quoteError ? <Text style={styles.errorBox}>{quoteError}</Text> : null}
          {q && !quoteError ? (
            <Card>
              {q.lines.map((l) => (
                <View key={l.serviceId} style={styles.row}>
                  <Text style={styles.rowLabel}>
                    {l.name} × {l.quantity}
                    {l.packageName ? ` (package: ${l.packageName})` : ''}
                  </Text>
                  <Text style={styles.rowValue}>{l.coveredUnits ? 'Package' : formatPaise(l.lineTotal)}</Text>
                </View>
              ))}
              {q.offer ? (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Offer: {q.offer.title}</Text>
                  <Text style={[styles.rowValue, { color: COLORS.success }]}>−{formatPaise(q.offer.discount)}</Text>
                </View>
              ) : null}
              {q.membership ? (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Membership: {q.membership.planName}</Text>
                  <Text style={[styles.rowValue, { color: COLORS.success }]}>−{formatPaise(q.membership.discount)}</Text>
                </View>
              ) : null}
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.total}>Total</Text>
                <Text style={styles.total}>{formatPaise(q.total)}</Text>
              </View>
            </Card>
          ) : null}
          {submitError ? <Text style={styles.errorBox}>{submitError}</Text> : null}
          <Button
            title="Create bill"
            loading={create.isPending}
            disabled={!q || Boolean(quoteError) || quote.isFetching}
            onPress={() => {
              setSubmitError('')
              create.mutate()
            }}
          />
        </>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, color: COLORS.muted, marginBottom: 8 },
  error: { color: COLORS.error, fontSize: 13, marginBottom: 8 },
  retry: { color: COLORS.brown, fontWeight: '700', textDecorationLine: 'underline' },
  errorBox: { color: COLORS.error, backgroundColor: '#fdecea', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 14 },
  pick: { borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, minHeight: 48, justifyContent: 'center' },
  pickOn: { borderColor: COLORS.brown, backgroundColor: COLORS.goldSoft },
  pickTitle: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  lineCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 10 },
  lineName: { flex: 1, fontSize: 15, color: COLORS.ink },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyBtn: { minWidth: 40, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  qtyBtnText: { fontSize: 20, color: COLORS.brown, fontWeight: '700' },
  qtyValue: { minWidth: 28, textAlign: 'center', fontSize: 16, color: COLORS.ink, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff', justifyContent: 'center' },
  chipOn: { backgroundColor: COLORS.brown, borderColor: COLORS.brown },
  chipText: { fontSize: 14, color: COLORS.ink },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  rowLabel: { flex: 1, fontSize: 14, color: COLORS.muted },
  rowValue: { fontSize: 14, color: COLORS.ink },
  divider: { height: 1, backgroundColor: COLORS.line, marginVertical: 6 },
  total: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
})
