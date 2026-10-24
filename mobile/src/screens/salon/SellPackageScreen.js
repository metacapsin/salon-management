import { useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchPackages, sellPackage } from '../../api/packagesApi'
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

const PAYMENT = { Paid: 'paid', 'Pay later': 'pending' }
const METHODS = { Cash: 'cash', UPI: 'upi', Card: 'card', Other: 'other' }
const PHONE_OK = /^\d{10}$/
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/

// Sell a package to a customer. The server decides the price, expiry and session balance; we send only
// which package, to whom, and how it was paid. A retry or double tap uses the same key, so it is sold once.
export default function SellPackageScreen({ navigation }) {
  const { activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const today = todayString()
  const keyRef = useRef(newRequestKey())

  const [packageId, setPackageId] = useState('')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [paymentLabel, setPaymentLabel] = useState('Paid')
  const [methodLabel, setMethodLabel] = useState('Cash')
  const [startsOn, setStartsOn] = useState(today)
  const [confirmDuplicate, setConfirmDuplicate] = useState(false)
  const [duplicate, setDuplicate] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')

  const packages = useQuery({ queryKey: ['packages', activeSalonId, 'active'], queryFn: () => fetchPackages({ status: 'active' }), staleTime: 0 })
  const onSale = (packages.data ?? []).filter((p) => (!p.saleStartsOn || today >= p.saleStartsOn) && (!p.saleEndsOn || today <= p.saleEndsOn))
  const chosen = onSale.find((p) => p.id === packageId)

  const sell = useMutation({
    mutationFn: (body) => sellPackage(body),
    onSuccess: (cp) => {
      queryClient.invalidateQueries({ queryKey: ['customer-packages', activeSalonId] })
      navigation.replace('CustomerPackageDetail', { id: cp.id, title: cp.packageName })
    },
    onError: (error) => {
      if (error?.code === 'DUPLICATE_PACKAGE') {
        setDuplicate(true)
        setFormError('')
        return
      }
      setErrors(error?.fieldErrors ?? {})
      setFormError(error?.fieldErrors && Object.keys(error.fieldErrors).length ? 'Please check the highlighted fields.' : friendlyError(error))
    },
  })

  function changePhone(value) {
    setPhone(value.replace(/\D/g, '').slice(0, 10))
    setDuplicate(false)
    setConfirmDuplicate(false)
  }

  function submit() {
    setFormError('')
    const found = {}
    if (!packageId) found.packageId = 'Choose a package.'
    if (!PHONE_OK.test(phone)) found.customerPhone = 'Enter a 10-digit mobile number.'
    if (name.trim().length < 1) found.customerName = 'Enter the customer name.'
    if (!DATE_OK.test(startsOn)) found.startsOn = 'Use a date like 2026-11-01.'
    setErrors(found)
    if (Object.keys(found).length) return
    sell.mutate({
      requestKey: keyRef.current,
      packageId,
      customerPhone: phone,
      customerName: name.trim(),
      paymentStatus: PAYMENT[paymentLabel],
      paymentMethod: METHODS[methodLabel],
      startsOn,
      confirmDuplicate,
    })
  }

  return (
    <Screen>
      <SectionTitle>Package</SectionTitle>
      {packages.isLoading ? <ActivityIndicator color={COLORS.brown} /> : null}
      {packages.isError ? <Text style={styles.error}>{friendlyError(packages.error)}</Text> : null}
      {!packages.isLoading && onSale.length === 0 ? <Text style={styles.muted}>No package is on sale right now. Add one first.</Text> : null}
      {onSale.map((p) => (
        <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Choose ${p.name}`} onPress={() => setPackageId(p.id)} style={[styles.pick, packageId === p.id && styles.pickOn]}>
          <Text style={styles.pickTitle}>
            {p.name} · {formatMoney(p.packagePrice)}
          </Text>
          <Text style={styles.muted}>{p.items.map((i) => `${i.serviceName} × ${i.sessions}`).join(', ')}</Text>
        </Pressable>
      ))}
      {errors.packageId ? <Text style={styles.error}>{errors.packageId}</Text> : null}

      <Card style={{ marginTop: 12 }}>
        {formError ? <Text style={styles.banner}>{formError}</Text> : null}
        <TextField label="Customer mobile (10 digits)" value={phone} onChangeText={changePhone} error={errors.customerPhone} keyboardType="number-pad" maxLength={10} placeholder="9876543210" />
        <TextField label="Customer name" value={name} onChangeText={setName} error={errors.customerName} maxLength={100} />
        <ChoiceChips label="Payment" options={Object.keys(PAYMENT)} value={paymentLabel} onChange={setPaymentLabel} error={errors.paymentStatus} />
        {paymentLabel === 'Paid' ? <ChoiceChips label="Paid by" options={Object.keys(METHODS)} value={methodLabel} onChange={setMethodLabel} error={errors.paymentMethod} /> : null}
        <TextField label="Starts on (YYYY-MM-DD)" value={startsOn} onChangeText={setStartsOn} error={errors.startsOn} autoCapitalize="none" maxLength={10} />
        {chosen ? <Text style={styles.muted}>Customer pays {formatMoney(chosen.packagePrice)}. Valid {chosen.validityDays} days from the start date.</Text> : null}

        {duplicate ? (
          <View style={styles.warn}>
            <Text style={styles.warnText}>This customer already has this package with sessions left. Sell another one anyway?</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sell another anyway"
              onPress={() => {
                setConfirmDuplicate(true)
                setDuplicate(false)
                sell.mutate({
                  requestKey: keyRef.current,
                  packageId,
                  customerPhone: phone,
                  customerName: name.trim(),
                  paymentStatus: PAYMENT[paymentLabel],
                  paymentMethod: METHODS[methodLabel],
                  startsOn,
                  confirmDuplicate: true,
                })
              }}
              style={styles.warnBtn}
            >
              <Text style={styles.warnBtnText}>Yes, sell another</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={{ height: 12 }} />
        <Button title="Sell package" onPress={submit} loading={sell.isPending} disabled={onSale.length === 0} />
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
  warn: { backgroundColor: COLORS.goldSoft, borderRadius: 10, padding: 12, marginTop: 8 },
  warnText: { fontSize: 14, color: COLORS.ink, marginBottom: 8 },
  warnBtn: { minHeight: 44, borderRadius: 10, backgroundColor: COLORS.brown, alignItems: 'center', justifyContent: 'center' },
  warnBtnText: { color: '#fff', fontWeight: '600' },
})
