import { useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchInvoice, recordPayment, refundPayment, voidInvoice } from '../../api/billingApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { roleCan } from '../../auth/permissions'
import Button from '../../components/Button'
import { StatusBadge } from '../../components/Chips'
import { ChoiceChips } from '../../components/Form'
import { Card, ErrorNote, Screen, SectionTitle } from '../../components/Screen'
import { LoadingState } from '../../components/States'
import TextField from '../../components/TextField'
import { COLORS } from '../../config/theme'
import { newRequestKey, paiseToRupeesText, rupeesTextToPaise } from '../../utils/money'
import { formatPaise } from '../../utils/formatPaise'
import { dateOf, invoiceBadge } from './BillingScreen'

const METHODS = { Cash: 'cash', UPI: 'upi', Card: 'card' }
const METHOD_LABEL = { cash: 'Cash', upi: 'UPI', card: 'Card' }

function Row({ label, value, bold, color }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold, color && { color }]}>{value}</Text>
    </View>
  )
}

// Money form for a payment (taking money) or a refund (giving money back). One request key per attempt:
// if the network drops and the button is pressed again, the same key is sent, so the server never moves the same money twice.
function MoneyForm({ invoice, kind, maxAmount, onDone }) {
  const { activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const isRefund = kind === 'refund'
  const keyRef = useRef(newRequestKey())
  const [methodLabel, setMethodLabel] = useState('Cash')
  const [amount, setAmount] = useState(paiseToRupeesText(maxAmount))
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')

  const pay = useMutation({
    mutationFn: (body) => (isRefund ? refundPayment(invoice.id, body) : recordPayment(invoice.id, body)),
    onSuccess: () => {
      keyRef.current = newRequestKey() // the next one is a new attempt
      queryClient.invalidateQueries({ queryKey: ['invoice', activeSalonId, invoice.id] })
      queryClient.invalidateQueries({ queryKey: ['invoices', activeSalonId] })
      queryClient.invalidateQueries({ queryKey: ['billing-summary', activeSalonId] })
      onDone()
    },
    onError: (error) => {
      setErrors(error?.fieldErrors ?? {})
      setFormError(error?.fieldErrors && Object.keys(error.fieldErrors).length ? 'Please check the highlighted fields.' : friendlyError(error))
    },
  })

  function submit() {
    setFormError('')
    const paise = rupeesTextToPaise(amount)
    const found = {}
    if (paise === null) found.amount = 'Enter an amount like 500 or 499.50.'
    else if (paise > maxAmount) found.amount = isRefund ? `Refund is more than the amount received (${formatPaise(maxAmount)}).` : `Amount is more than the amount due (${formatPaise(maxAmount)}).`
    if (isRefund && note.trim().length < 3) found.note = 'Please give a reason (at least 3 characters).'
    setErrors(found)
    if (Object.keys(found).length) return
    pay.mutate({ requestKey: keyRef.current, method: METHODS[methodLabel], amount: paise, reference: reference.trim(), note: note.trim() })
  }

  return (
    <Card>
      <Text style={styles.formTitle}>{isRefund ? 'Refund money to the customer' : 'Record a payment'}</Text>
      {formError ? <Text style={styles.banner}>{formError}</Text> : null}
      <ChoiceChips label="Method" options={Object.keys(METHODS)} value={methodLabel} onChange={setMethodLabel} error={errors.method} />
      <TextField label="Amount (₹)" value={amount} onChangeText={setAmount} error={errors.amount} keyboardType="decimal-pad" />
      <TextField label="Reference (optional)" value={reference} onChangeText={setReference} error={errors.reference} placeholder="UPI id / card last 4" maxLength={80} />
      <TextField label={isRefund ? 'Reason (required)' : 'Note (optional)'} value={note} onChangeText={setNote} error={errors.note} maxLength={300} />
      <Button title={isRefund ? 'Save refund' : 'Save payment'} onPress={submit} loading={pay.isPending} />
      <View style={styles.gap} />
      <Button title="Cancel" onPress={onDone} disabled={pay.isPending} />
    </Card>
  )
}

// Cancels a bill (it stays in the list as "void"). Needs a reason; the server refuses while money is still received.
function VoidForm({ invoice, onDone }) {
  const { activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const run = useMutation({
    mutationFn: () => voidInvoice(invoice.id, note.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', activeSalonId, invoice.id] })
      queryClient.invalidateQueries({ queryKey: ['invoices', activeSalonId] })
      queryClient.invalidateQueries({ queryKey: ['billing-summary', activeSalonId] })
      onDone()
    },
    onError: (e) => setError(e?.fieldErrors?.note ?? friendlyError(e)),
  })

  return (
    <Card>
      <Text style={styles.formTitle}>Cancel this bill?</Text>
      <Text style={styles.muted}>The bill stays in your list marked "void" and cannot be used again. A used package session is not given back.</Text>
      {error ? <Text style={styles.banner}>{error}</Text> : null}
      <TextField label="Reason (required)" value={note} onChangeText={setNote} maxLength={300} />
      <Button
        title="Yes, cancel the bill"
        loading={run.isPending}
        onPress={() => {
          setError('')
          if (note.trim().length < 3) return setError('Please give a reason (at least 3 characters).')
          run.mutate()
        }}
      />
      <View style={styles.gap} />
      <Button title="Keep the bill" onPress={onDone} disabled={run.isPending} />
    </Card>
  )
}

export default function InvoiceDetailScreen({ route }) {
  const { id } = route.params
  const { role, activeSalonId } = useAuth()
  const [panel, setPanel] = useState(null) // 'pay' | 'refund' | 'void' | null
  const query = useQuery({ queryKey: ['invoice', activeSalonId, id], queryFn: () => fetchInvoice(id) })

  const invoice = query.data?.invoice
  const payments = query.data?.payments ?? []
  const isFinal = invoice?.status === 'final'
  const received = invoice ? invoice.amountPaid - invoice.amountRefunded : 0
  // These only decide which buttons to show. The server checks the role again (billing.write / refund / void).
  const canPay = roleCan(role, 'billing.write') && isFinal && invoice.amountDue > 0
  const canRefund = roleCan(role, 'billing.refund') && isFinal && received > 0
  const canVoid = roleCan(role, 'billing.void') && isFinal

  return (
    <Screen onRefresh={query.refetch} refreshing={query.isRefetching}>
      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? <ErrorNote message={friendlyError(query.error)} onRetry={query.refetch} /> : null}

      {invoice ? (
        <>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{invoice.invoiceNumber}</Text>
            <StatusBadge status={invoiceBadge(invoice)} />
          </View>
          <Text style={styles.muted}>{query.data.salon.name}</Text>

          <Card>
            <Text style={styles.name}>{invoice.customerName}</Text>
            <Text style={styles.muted}>
              {invoice.customerPhone} · {dateOf(invoice.createdAt)}
            </Text>
            {invoice.status === 'void' && invoice.voidReason ? <Text style={styles.voidNote}>Cancelled: {invoice.voidReason}</Text> : null}
          </Card>

          <SectionTitle>Services</SectionTitle>
          <Card>
            {invoice.lines.map((l, i) => (
              <View key={`${l.serviceId}-${i}`} style={styles.line}>
                <View style={styles.lineName}>
                  <Text style={styles.value}>
                    {l.name} × {l.quantity}
                  </Text>
                  {l.package ? <Text style={styles.pkg}>Covered by package: {l.package.packageName}</Text> : null}
                </View>
                <Text style={styles.value}>{l.package ? 'Package' : formatPaise(l.lineTotal)}</Text>
              </View>
            ))}
          </Card>

          <SectionTitle>Amounts</SectionTitle>
          <Card>
            <Row label="Subtotal" value={formatPaise(invoice.subtotal)} />
            {invoice.offer ? <Row label={`Offer: ${invoice.offer.title}`} value={`−${formatPaise(invoice.offer.discount)}`} color={COLORS.success} /> : null}
            {invoice.membership ? <Row label={`Membership: ${invoice.membership.planName}`} value={`−${formatPaise(invoice.membership.discount)}`} color={COLORS.success} /> : null}
            <Row label="Taxable amount" value={formatPaise(invoice.taxableAmount)} />
            <Row label={`CGST (${invoice.tax.ratePercent / 2}%)`} value={formatPaise(invoice.tax.cgst)} />
            <Row label={`SGST (${invoice.tax.ratePercent / 2}%)`} value={formatPaise(invoice.tax.sgst)} />
            <View style={styles.divider} />
            <Row label="Total" value={formatPaise(invoice.total)} bold />
            <Row label="Paid" value={formatPaise(invoice.amountPaid)} />
            {invoice.amountRefunded > 0 ? <Row label="Refunded" value={formatPaise(invoice.amountRefunded)} /> : null}
            {invoice.status !== 'void' ? <Row label="Due" value={formatPaise(invoice.amountDue)} bold color={invoice.amountDue > 0 ? '#8a6100' : COLORS.success} /> : null}
          </Card>

          <SectionTitle>Payments</SectionTitle>
          {payments.length === 0 ? <Text style={styles.muted}>No payments yet.</Text> : null}
          {payments.map((p) => (
            <Card key={p.id}>
              <View style={styles.row}>
                <Text style={styles.value}>
                  {p.type === 'refund' ? 'Refund' : 'Payment'} · {METHOD_LABEL[p.method] ?? p.method}
                </Text>
                <Text style={[styles.value, p.type === 'refund' && { color: COLORS.error }]}>
                  {p.type === 'refund' ? '−' : ''}
                  {formatPaise(p.amount)}
                </Text>
              </View>
              <Text style={styles.muted}>{dateOf(p.createdAt)}</Text>
              {p.reference ? <Text style={styles.muted}>Ref: {p.reference}</Text> : null}
              {p.note ? <Text style={styles.muted}>{p.note}</Text> : null}
            </Card>
          ))}

          {panel === 'pay' && canPay ? <MoneyForm invoice={invoice} kind="payment" maxAmount={invoice.amountDue} onDone={() => setPanel(null)} /> : null}
          {panel === 'refund' && canRefund ? <MoneyForm invoice={invoice} kind="refund" maxAmount={received} onDone={() => setPanel(null)} /> : null}
          {panel === 'void' && canVoid && received <= 0 ? <VoidForm invoice={invoice} onDone={() => setPanel(null)} /> : null}
          {panel === null ? (
            <View style={styles.actions}>
              {canPay ? <Button title="Record a payment" onPress={() => setPanel('pay')} /> : null}
              {canRefund ? <Button title="Refund" onPress={() => setPanel('refund')} /> : null}
              {canVoid && received <= 0 ? <Button title="Cancel this bill" onPress={() => setPanel('void')} /> : null}
              {canVoid && received > 0 ? <Text style={styles.muted}>To cancel this bill, first refund the money received.</Text> : null}
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: COLORS.ink, fontFamily: 'serif' },
  name: { fontSize: 16, fontWeight: '600', color: COLORS.ink },
  muted: { fontSize: 13, color: COLORS.muted, marginTop: 2, marginBottom: 6 },
  voidNote: { fontSize: 13, color: COLORS.error, marginTop: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6 },
  lineName: { flex: 1 },
  pkg: { fontSize: 12, color: COLORS.success, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 3 },
  rowLabel: { flex: 1, fontSize: 14, color: COLORS.muted },
  rowValue: { fontSize: 14, color: COLORS.ink },
  value: { fontSize: 15, color: COLORS.ink },
  bold: { fontWeight: '700', color: COLORS.ink },
  divider: { height: 1, backgroundColor: COLORS.line, marginVertical: 6 },
  actions: { gap: 10, marginTop: 8 },
  gap: { height: 10 },
  formTitle: { fontSize: 17, fontWeight: '700', color: COLORS.ink, marginBottom: 12 },
  banner: { color: COLORS.error, backgroundColor: '#fdecea', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 14 },
})
