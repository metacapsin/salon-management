import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cancelMembership, fetchMember, markMembershipPaid } from '../../api/membershipsApi'
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
import { formatDate, formatMoney } from '../../utils/formatMoney'
import { discountText } from './MembershipTabs'

const METHODS = { Cash: 'cash', UPI: 'upi', Card: 'card', Other: 'other' }
const HISTORY_LABEL = { purchase: 'Bought', payment: 'Payment received', discount: 'Discount given', invoice_discount: 'Discount on a bill', cancel: 'Cancelled' }
const when = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

// One sold membership: its discount, payment, dates and history. Mark paid needs memberships.sell,
// cancel needs memberships.adjust (owner/manager). The server checks the role again.
export default function CustomerMembershipDetailScreen({ route }) {
  const { id } = route.params
  const { role, activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const canSell = roleCan(role, 'memberships.sell')
  const canAdjust = roleCan(role, 'memberships.adjust')
  const [panel, setPanel] = useState(null) // 'paid' | 'cancel' | null
  const [methodLabel, setMethodLabel] = useState('Cash')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const query = useQuery({ queryKey: ['customer-membership', activeSalonId, id], queryFn: () => fetchMember(id) })
  const cm = query.data?.customerMembership
  const history = query.data?.history ?? []

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['customer-membership', activeSalonId, id] })
    queryClient.invalidateQueries({ queryKey: ['customer-memberships', activeSalonId] })
    setPanel(null)
    setNote('')
    setError('')
  }
  const paid = useMutation({ mutationFn: () => markMembershipPaid(id, METHODS[methodLabel]), onSuccess: refresh, onError: (e) => setError(friendlyError(e)) })
  const cancel = useMutation({ mutationFn: () => cancelMembership(id, note.trim()), onSuccess: refresh, onError: (e) => setError(e?.fieldErrors?.note ?? friendlyError(e)) })

  const live = cm && cm.status !== 'cancelled'

  return (
    <Screen onRefresh={query.refetch} refreshing={query.isRefetching}>
      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? <ErrorNote message={friendlyError(query.error)} onRetry={query.refetch} /> : null}

      {cm ? (
        <>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{cm.planName}</Text>
            <StatusBadge status={cm.status} />
          </View>
          <Card>
            <Text style={styles.name}>{cm.customerName}</Text>
            <Text style={styles.muted}>{cm.customerPhone}</Text>
          </Card>

          <Card style={cm.benefitsActive ? styles.okCard : styles.waitCard}>
            <Text style={styles.discount}>{discountText(cm)}</Text>
            <Text style={styles.muted}>{cm.serviceIds.length ? `On ${cm.serviceIds.length} chosen service${cm.serviceIds.length === 1 ? '' : 's'}` : 'On all services'}</Text>
            <Text style={styles.state}>
              {cm.benefitsActive ? 'The discount is working now.' : cm.status === 'cancelled' ? 'This membership is cancelled.' : cm.paymentStatus === 'pending' ? 'The discount starts after the payment is received.' : cm.status === 'upcoming' ? 'The discount starts on the start date.' : 'This membership has expired.'}
            </Text>
          </Card>

          {cm.benefits.length ? (
            <>
              <SectionTitle>Benefits</SectionTitle>
              <Card>
                {cm.benefits.map((b) => (
                  <Text key={b} style={styles.benefit}>
                    • {b}
                  </Text>
                ))}
              </Card>
            </>
          ) : null}

          <SectionTitle>Details</SectionTitle>
          <Card>
            <Row label="Price paid" value={formatMoney(cm.pricePaid)} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Payment</Text>
              <StatusBadge status={cm.paymentStatus} />
            </View>
            {cm.paymentStatus === 'paid' ? <Row label="Paid by" value={cm.paymentMethod} /> : null}
            <Row label="Bought on" value={formatDate(cm.purchasedOn)} />
            <Row label="Starts" value={formatDate(cm.startsOn)} />
            <Row label="Expires" value={formatDate(cm.expiresOn)} />
          </Card>

          <SectionTitle>History</SectionTitle>
          {history.map((h) => (
            <Card key={h.id}>
              <View style={styles.row}>
                <Text style={styles.rowLabelDark}>{HISTORY_LABEL[h.type] ?? h.type}</Text>
                <Text style={styles.rowValue}>{h.amount ? formatMoney(h.amount) : ''}</Text>
              </View>
              <Text style={styles.muted}>{when(h.at)}</Text>
              {h.note ? <Text style={styles.muted}>{h.note}</Text> : null}
            </Card>
          ))}

          {error ? <Text style={styles.banner}>{error}</Text> : null}

          {panel === 'paid' ? (
            <Card>
              <Text style={styles.formTitle}>Payment received</Text>
              <ChoiceChips label="Paid by" options={Object.keys(METHODS)} value={methodLabel} onChange={setMethodLabel} />
              <Button title="Save payment" onPress={() => paid.mutate()} loading={paid.isPending} />
              <View style={styles.gap} />
              <Button title="Back" onPress={() => setPanel(null)} disabled={paid.isPending} />
            </Card>
          ) : null}

          {panel === 'cancel' ? (
            <Card>
              <Text style={styles.formTitle}>Cancel this membership?</Text>
              <Text style={styles.muted}>The customer stops getting the discount. This cannot be undone.</Text>
              <TextField label="Reason (required)" value={note} onChangeText={setNote} maxLength={300} />
              <Button
                title="Yes, cancel the membership"
                loading={cancel.isPending}
                onPress={() => {
                  setError('')
                  if (note.trim().length < 3) return setError('Please give a reason (at least 3 characters).')
                  cancel.mutate()
                }}
              />
              <View style={styles.gap} />
              <Button title="Keep the membership" onPress={() => setPanel(null)} disabled={cancel.isPending} />
            </Card>
          ) : null}

          {panel === null ? (
            <View style={styles.actions}>
              {canSell && live && cm.paymentStatus === 'pending' ? <Button title="Mark as paid" onPress={() => setPanel('paid')} /> : null}
              {canAdjust && live ? <Button title="Cancel this membership" onPress={() => setPanel('cancel')} /> : null}
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: COLORS.ink, fontFamily: 'serif' },
  name: { fontSize: 16, fontWeight: '600', color: COLORS.ink },
  muted: { fontSize: 13, color: COLORS.muted, marginTop: 2, marginBottom: 6 },
  okCard: { borderColor: COLORS.success },
  waitCard: { borderColor: COLORS.gold, backgroundColor: COLORS.goldSoft },
  discount: { fontSize: 22, fontWeight: '700', color: COLORS.success },
  state: { fontSize: 13, color: COLORS.ink, marginTop: 2 },
  benefit: { fontSize: 14, color: COLORS.ink, paddingVertical: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 4 },
  rowLabel: { fontSize: 14, color: COLORS.muted },
  rowLabelDark: { flex: 1, fontSize: 14, color: COLORS.ink },
  rowValue: { fontSize: 14, color: COLORS.ink, fontWeight: '600' },
  actions: { gap: 10, marginTop: 8 },
  gap: { height: 10 },
  formTitle: { fontSize: 17, fontWeight: '700', color: COLORS.ink, marginBottom: 8 },
  banner: { color: COLORS.error, backgroundColor: '#fdecea', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 14 },
})
