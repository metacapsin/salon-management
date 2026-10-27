import { useEffect, useLayoutEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { fetchBillingSummary } from '../../api/dashboardApi'
import { fetchInvoices } from '../../api/billingApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { roleCan } from '../../auth/permissions'
import { FilterChips, StatusBadge } from '../../components/Chips'
import { Card, ErrorNote, StatCard } from '../../components/Screen'
import { EmptyState, LoadingState } from '../../components/States'
import { COLORS, TOUCH_MIN } from '../../config/theme'
import { formatPaise } from '../../utils/formatPaise'

// Each chip is a ready-made set of server filters. "Void" bills are cancelled bills.
const FILTERS = [
  { value: 'all', label: 'All', params: {} },
  { value: 'unpaid', label: 'Unpaid', params: { paymentStatus: 'unpaid', status: 'final' } },
  { value: 'partial', label: 'Partial', params: { paymentStatus: 'partial', status: 'final' } },
  { value: 'paid', label: 'Paid', params: { paymentStatus: 'paid', status: 'final' } },
  { value: 'void', label: 'Void', params: { status: 'void' } },
]

export const dateOf = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
// A void bill shows "void", otherwise unpaid / partial / paid.
export const invoiceBadge = (inv) => (inv.status === 'void' ? 'void' : inv.paymentStatus)

function useDebounced(value, ms = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export default function BillingScreen({ navigation }) {
  const { activeSalonId, role } = useAuth()
  const canWrite = roleCan(role, 'billing.write')
  const [filter, setFilter] = useState('all')
  const [text, setText] = useState('')
  const search = useDebounced(text.trim())
  const params = FILTERS.find((f) => f.value === filter).params

  const summary = useQuery({ queryKey: ['billing-summary', activeSalonId, 'all'], queryFn: () => fetchBillingSummary() })
  const query = useInfiniteQuery({
    queryKey: ['invoices', activeSalonId, filter, search],
    queryFn: ({ pageParam }) => fetchInvoices({ ...params, search: search || undefined, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page * last.meta.pageSize < last.meta.total ? last.meta.page + 1 : undefined),
  })

  useLayoutEffect(() => {
    if (!canWrite) return
    navigation.setOptions({
      headerRight: () => (
        <Pressable accessibilityRole="button" accessibilityLabel="New bill" onPress={() => navigation.navigate('CreateBill')} style={styles.add}>
          <Text style={styles.addText}>+ New bill</Text>
        </Pressable>
      ),
    })
  }, [navigation, canWrite])

  const items = query.data?.pages.flatMap((p) => p.items) ?? []
  const s = summary.data

  const header = (
    <View>
      <View style={styles.stats}>
        <StatCard label="Total billed" value={formatPaise(s?.billed)} loading={summary.isLoading} />
        <StatCard label="Received" value={formatPaise(s?.received)} loading={summary.isLoading} />
        <StatCard label="Pending" value={formatPaise(s?.pending)} loading={summary.isLoading} hint={s ? `${s.pendingCount} unpaid bills` : undefined} />
      </View>
      <TextInput
        accessibilityLabel="Search bills"
        value={text}
        onChangeText={setText}
        placeholder="Bill number, name or phone"
        placeholderTextColor="#a8978a"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.search}
      />
      <FilterChips options={FILTERS} value={filter} onChange={setFilter} inset={0} />
      {query.isError ? <ErrorNote message={friendlyError(query.error)} onRetry={query.refetch} /> : null}
    </View>
  )

  return (
    <FlatList
      style={styles.screen}
      data={items}
      keyExtractor={(i) => i.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => {
        query.refetch()
        summary.refetch()
      }}
      onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={query.isLoading ? <LoadingState /> : !query.isError ? <EmptyState title="No bills found" /> : null}
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={COLORS.brown} /> : null}
      renderItem={({ item }) => (
        <Pressable accessibilityRole="button" accessibilityLabel={`Open bill ${item.invoiceNumber}`} onPress={() => navigation.navigate('InvoiceDetail', { id: item.id, number: item.invoiceNumber })}>
          <Card>
            <View style={styles.top}>
              <Text style={styles.number}>{item.invoiceNumber}</Text>
              <StatusBadge status={invoiceBadge(item)} />
            </View>
            <Text style={styles.name}>{item.customerName}</Text>
            <Text style={styles.muted}>
              {item.customerPhone} · {dateOf(item.createdAt)}
            </Text>
            <View style={styles.amounts}>
              <Text style={styles.total}>{formatPaise(item.total)}</Text>
              {item.status !== 'void' && item.amountDue > 0 ? <Text style={styles.due}>Due {formatPaise(item.amountDue)}</Text> : null}
            </View>
          </Card>
        </Pressable>
      )}
    />
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream },
  list: { padding: 16, paddingBottom: 24 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  search: { minHeight: TOUCH_MIN, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, backgroundColor: '#fff', paddingHorizontal: 14, fontSize: 16, color: COLORS.ink },
  add: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 12 },
  addText: { color: COLORS.gold, fontSize: 16, fontWeight: '700' },
  loader: { marginTop: 24 },
  empty: { textAlign: 'center', color: COLORS.muted, marginTop: 32 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 },
  number: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  name: { fontSize: 16, fontWeight: '600', color: COLORS.ink },
  muted: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  amounts: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  total: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  due: { fontSize: 13, fontWeight: '600', color: '#8a6100' },
})
