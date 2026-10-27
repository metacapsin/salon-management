import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cancelCustomerPackage, fetchCustomerPackage, markPackagePaid } from '../../api/packagesApi'
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

const METHODS = { Cash: 'cash', UPI: 'upi', Card: 'card', Other: 'other' }
const HISTORY_LABEL = { purchase: 'Sold', redemption: 'Session used', adjustment: 'Adjusted', payment: 'Payment received', cancel: 'Cancelled' }
const dateTime = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

// One sold package: balance per service, payment, and the full history. Buttons depend on the role
// (packages.sell: mark paid, packages.adjust: cancel). The server checks the role again.
export default function CustomerPackageDetailScreen({ route }) {
  const { id } = route.params
  const { role, activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const canSell = roleCan(role, 'packages.sell')
  const canAdjust = roleCan(role, 'packages.adjust')
  const [panel, setPanel] = useState(null) // 'paid' | 'cancel' | null
  const [methodLabel, setMethodLabel] = useState('Cash')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const query = useQuery({ queryKey: ['customer-package', activeSalonId, id], queryFn: () => fetchCustomerPackage(id) })
  const cp = query.data?.customerPackage
  const history = query.data?.history ?? []

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['customer-package', activeSalonId, id] })
    queryClient.invalidateQueries({ queryKey: ['customer-packages', activeSalonId] })
    setPanel(null)
    setNote('')
    setError('')
  }
  const paid = useMutation({ mutationFn: () => markPackagePaid(id, METHODS[methodLabel]), onSuccess: refresh, onError: (e) => setError(friendlyError(e)) })
  const cancel = useMutation({ mutationFn: () => cancelCustomerPackage(id, note.trim()), onSuccess: refresh, onError: (e) => setError(e?.fieldErrors?.note ?? friendlyError(e)) })

  const live = cp && cp.status !== 'cancelled'

  return (
    <Screen onRefresh={query.refetch} refreshing={query.isRefetching}>
      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? <ErrorNote message={friendlyError(query.error)} onRetry={query.refetch} /> : null}

      {cp ? (
        <>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{cp.packageName}</Text>
            <StatusBadge status={cp.status} />
          </View>
          <Card>
            <Text style={styles.name}>{cp.customerName}</Text>
            <Text style={styles.muted}>{cp.customerPhone}</Text>
          </Card>

          <SectionTitle>Sessions</SectionTitle>
          <Card>
            {cp.items.map((i) => (
              <View key={String(i.serviceId)} style={styles.row}>
                <Text style={styles.rowLabelDark}>{i.serviceName}</Text>
                <Text style={styles.rowValue}>
                  {i.remaining} left of {i.total}
                </Text>
              </View>
            ))}
            <View style={styles.divider} />
            <Row label="Total" value={`${cp.remainingSessions} left of ${cp.totalSessions}`} />
          </Card>

          <SectionTitle>Details</SectionTitle>
          <Card>
            <Row label="Price paid" value={formatMoney(cp.pricePaid)} />
            <Row label="Services total" value={formatMoney(cp.originalPrice)} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Payment</Text>
              <StatusBadge status={cp.paymentStatus} />
            </View>
            {cp.paymentStatus === 'paid' ? <Row label="Paid by" value={cp.paymentMethod} /> : null}
            <Row label="Bought on" value={formatDate(cp.purchasedOn)} />
            <Row label="Starts" value={formatDate(cp.startsOn)} />
            <Row label="Expires" value={formatDate(cp.expiresOn)} />
          </Card>

          <SectionTitle>History</SectionTitle>
          {history.map((h) => (
            <Card key={h.id}>
              <View style={styles.row}>
                <Text style={styles.rowLabelDark}>
                  {HISTORY_LABEL[h.type] ?? h.type}
                  {h.serviceName ? ` · ${h.serviceName}` : ''}
                </Text>
                <Text style={styles.rowValue}>{h.sessions ? `${h.sessions > 0 ? '+' : ''}${h.sessions}` : h.amount ? formatMoney(h.amount) : ''}</Text>
              </View>
              <Text style={styles.muted}>{dateTime(h.at)}</Text>
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
              <Text style={styles.formTitle}>Cancel this package?</Text>
              <Text style={styles.muted}>The remaining sessions can no longer be used. This cannot be undone.</Text>
              <TextField label="Reason (required)" value={note} onChangeText={setNote} maxLength={300} />
              <Button
                title="Yes, cancel the package"
                loading={cancel.isPending}
                onPress={() => {
                  setError('')
                  if (note.trim().length < 3) return setError('Please give a reason (at least 3 characters).')
                  cancel.mutate()
                }}
              />
              <View style={styles.gap} />
              <Button title="Keep the package" onPress={() => setPanel(null)} disabled={cancel.isPending} />
            </Card>
          ) : null}

          {panel === null ? (
            <View style={styles.actions}>
              {canSell && live && cp.paymentStatus === 'pending' ? <Button title="Mark as paid" onPress={() => setPanel('paid')} /> : null}
              {canAdjust && live ? <Button title="Cancel this package" onPress={() => setPanel('cancel')} /> : null}
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 4 },
  rowLabel: { fontSize: 14, color: COLORS.muted },
  rowLabelDark: { flex: 1, fontSize: 14, color: COLORS.ink },
  rowValue: { fontSize: 14, color: COLORS.ink, fontWeight: '600' },
  divider: { height: 1, backgroundColor: COLORS.line, marginVertical: 6 },
  actions: { gap: 10, marginTop: 8 },
  gap: { height: 10 },
  formTitle: { fontSize: 17, fontWeight: '700', color: COLORS.ink, marginBottom: 8 },
  banner: { color: COLORS.error, backgroundColor: '#fdecea', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 14 },
})
