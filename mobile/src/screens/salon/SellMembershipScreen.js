import { useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchPlans, sellMembership } from '../../api/membershipsApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import Button from '../../components/Button'
import { ChoiceChips } from '../../components/Form'
import { Card, Screen, SectionTitle } from '../../components/Screen'
import TextField from '../../components/TextField'
import { COLORS } from '../../config/theme'
import { todayString } from '../../utils/dates'
import { formatMoney } from '../../utils/formatMoney'
import { newRequestKey } from '../../utils/money'
import { discountText } from './MembershipTabs'

const PAYMENT = { Paid: 'paid', 'Pay later': 'pending' }
const METHODS = { Cash: 'cash', UPI: 'upi', Card: 'card', Other: 'other' }
const PHONE_OK = /^\d{10}$/
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/

// Sell a membership to a customer. The server decides the price, dates and discount rule; we send only
// which plan, to whom, and how it was paid. A retry or double tap uses the same key, so it is sold once.
export default function SellMembershipScreen({ navigation }) {
  const { activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const keyRef = useRef(newRequestKey())

  const [planId, setPlanId] = useState('')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [paymentLabel, setPaymentLabel] = useState('Paid')
  const [methodLabel, setMethodLabel] = useState('Cash')
  const [startsOn, setStartsOn] = useState(todayString())
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')

  const plans = useQuery({ queryKey: ['membership-plans', activeSalonId, 'active'], queryFn: () => fetchPlans({ status: 'active' }), staleTime: 0 })
  const chosen = (plans.data ?? []).find((p) => p.id === planId)
  const clear = (...keys) => setErrors((e) => ({ ...e, ...Object.fromEntries(keys.map((k) => [k, undefined])) }))

  const sell = useMutation({
    mutationFn: sellMembership,
    onSuccess: (cm) => {
      queryClient.invalidateQueries({ queryKey: ['customer-memberships', activeSalonId] })
      navigation.replace('CustomerMembershipDetail', { id: cm.id, title: cm.planName })
    },
    onError: (error) => {
      setErrors(error?.fieldErrors ?? {})
      setFormError(error?.fieldErrors && Object.keys(error.fieldErrors).length ? 'Please check the highlighted fields.' : friendlyError(error))
    },
  })

  function submit() {
    setFormError('')
    const found = {}
    if (!planId) found.planId = 'Choose a plan.'
    if (!PHONE_OK.test(phone)) found.customerPhone = 'Enter a 10-digit mobile number.'
    if (name.trim().length < 1) found.customerName = 'Enter the customer name.'
    if (!DATE_OK.test(startsOn)) found.startsOn = 'Use a date like 2026-11-01.'
    setErrors(found)
    if (Object.keys(found).length) return
    sell.mutate({
      requestKey: keyRef.current,
      planId,
      customerPhone: phone,
      customerName: name.trim(),
      paymentStatus: PAYMENT[paymentLabel],
      paymentMethod: METHODS[methodLabel],
      startsOn,
    })
  }

  return (
    <Screen>
      <SectionTitle>Plan</SectionTitle>
      {plans.isLoading ? <ActivityIndicator color={COLORS.brown} /> : null}
      {plans.isError ? <Text style={styles.error}>{friendlyError(plans.error)}</Text> : null}
      {!plans.isLoading && (plans.data ?? []).length === 0 ? <Text style={styles.muted}>No plan is on sale. The owner needs to add one first.</Text> : null}
      {(plans.data ?? []).map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={`Choose plan ${p.name}`}
          onPress={() => {
            setPlanId(p.id)
            clear('planId')
          }}
          style={[styles.pick, planId === p.id && styles.pickOn]}
        >
          <Text style={styles.pickTitle}>
            {p.name} · {formatMoney(p.price)}
          </Text>
          <Text style={styles.muted}>
            {discountText(p)} · valid {p.durationDays} days
          </Text>
        </Pressable>
      ))}
      {errors.planId ? <Text style={styles.error}>{errors.planId}</Text> : null}

      <Card style={{ marginTop: 12 }}>
        {formError ? <Text style={styles.banner}>{formError}</Text> : null}
        <TextField label="Customer mobile (10 digits)" value={phone} onChangeText={(v) => { setPhone(v.replace(/\D/g, '').slice(0, 10)); clear('customerPhone') }} error={errors.customerPhone} keyboardType="number-pad" maxLength={10} placeholder="9876543210" />
        <TextField label="Customer name" value={name} onChangeText={(v) => { setName(v); clear('customerName') }} error={errors.customerName} maxLength={100} />
        <ChoiceChips label="Payment" options={Object.keys(PAYMENT)} value={paymentLabel} onChange={setPaymentLabel} error={errors.paymentStatus} />
        {paymentLabel === 'Paid' ? <ChoiceChips label="Paid by" options={Object.keys(METHODS)} value={methodLabel} onChange={setMethodLabel} error={errors.paymentMethod} /> : null}
        <TextField label="Starts on (YYYY-MM-DD)" value={startsOn} onChangeText={(v) => { setStartsOn(v); clear('startsOn') }} error={errors.startsOn} autoCapitalize="none" maxLength={10} />
        {chosen ? <Text style={styles.muted}>Customer pays {formatMoney(chosen.price)}. The discount works only after the payment is received.</Text> : null}
        <Button title="Sell membership" onPress={submit} loading={sell.isPending} disabled={(plans.data ?? []).length === 0} />
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, color: COLORS.muted, marginBottom: 8 },
  error: { color: COLORS.error, fontSize: 13, marginBottom: 8 },
  banner: { color: COLORS.error, backgroundColor: '#fdecea', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 14 },
  pick: { borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, minHeight: 48, justifyContent: 'center' },
  pickOn: { borderColor: COLORS.brown, backgroundColor: COLORS.goldSoft },
  pickTitle: { fontSize: 15, fontWeight: '600', color: COLORS.ink },
})
