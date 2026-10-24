import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { fetchMembers, fetchPlans } from '../../api/membershipsApi'
import { friendlyError } from '../../api/client'
import { FilterChips, StatusBadge } from '../../components/Chips'
import { Card, ErrorNote } from '../../components/Screen'
import { COLORS, TOUCH_MIN } from '../../config/theme'
import { formatDate, formatMoney } from '../../utils/formatMoney'

export const discountText = (x) => (x.discountType === 'percent' ? `${x.discountValue}% off` : `₹${x.discountValue} off`)

const PLAN_VIEWS = [
  { value: 'active', label: 'Active' },
  { value: undefined, label: 'All' },
]
const MEMBER_STATUS = [
  { value: 'active', label: 'Active' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
]

function useDebounced(value, ms = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

// Membership plans the salon offers (Silver, Gold...). Only the Owner may add or change them.
export function PlansTab({ navigation, canWrite, salonId }) {
  const [status, setStatus] = useState('active')
  const query = useQuery({ queryKey: ['membership-plans', salonId, status ?? 'all'], queryFn: () => fetchPlans({ status }) })
  return (
    <FlatList
      data={query.data ?? []}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.list}
      refreshing={query.isRefetching}
      onRefresh={query.refetch}
      ListHeaderComponent={
        <View>
          {canWrite ? <FilterChips options={PLAN_VIEWS} value={status} onChange={setStatus} inset={0} /> : null}
          {query.isError ? <ErrorNote message={friendlyError(query.error)} onRetry={query.refetch} /> : null}
        </View>
      }
      ListEmptyComponent={query.isLoading ? <ActivityIndicator style={styles.loader} color={COLORS.brown} /> : !query.isError ? <Text style={styles.empty}>No membership plans yet.</Text> : null}
      renderItem={({ item }) => {
        const card = (
          <Card style={!item.active && styles.stopped}>
            <View style={styles.top}>
              <Text style={styles.title}>{item.name}</Text>
              {!item.active ? <StatusBadge status="inactive" /> : null}
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatMoney(item.price)}</Text>
              <Text style={styles.discount}>{discountText(item)}</Text>
            </View>
            <Text style={styles.muted}>
              Valid {item.durationDays} days · {item.serviceIds.length ? `${item.serviceIds.length} service${item.serviceIds.length === 1 ? '' : 's'}` : 'All services'}
            </Text>
            {item.benefits.length ? <Text style={styles.desc}>{item.benefits.join(' · ')}</Text> : null}
            {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
          </Card>
        )
        if (!canWrite) return card
        return (
          <Pressable accessibilityRole="button" accessibilityLabel={`Edit plan ${item.name}`} onPress={() => navigation.navigate('MembershipPlanForm', { plan: item })}>
            {card}
          </Pressable>
        )
      }}
    />
  )
}

// Memberships already sold to customers.
export function MembersTab({ navigation, salonId }) {
  const [status, setStatus] = useState('active')
  const [text, setText] = useState('')
  const search = useDebounced(text.trim())
  const query = useInfiniteQuery({
    queryKey: ['customer-memberships', salonId, status, search],
    queryFn: ({ pageParam }) => fetchMembers({ search: search || undefined, status, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page * last.meta.pageSize < last.meta.total ? last.meta.page + 1 : undefined),
  })
  const items = query.data?.pages.flatMap((p) => p.items) ?? []
  return (
    <FlatList
      data={items}
      keyExtractor={(c) => c.id}
      contentContainerStyle={styles.list}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={query.refetch}
      onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View>
          <TextInput
            accessibilityLabel="Search members"
            value={text}
            onChangeText={setText}
            placeholder="Customer name, phone or plan"
            placeholderTextColor="#a8978a"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.search}
          />
          <FilterChips options={MEMBER_STATUS} value={status} onChange={setStatus} inset={0} />
          {query.isError ? <ErrorNote message={friendlyError(query.error)} onRetry={query.refetch} /> : null}
        </View>
      }
      ListEmptyComponent={query.isLoading ? <ActivityIndicator style={styles.loader} color={COLORS.brown} /> : !query.isError ? <Text style={styles.empty}>No members here.</Text> : null}
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={COLORS.brown} /> : null}
      renderItem={({ item }) => (
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.planName} of ${item.customerName}`} onPress={() => navigation.navigate('CustomerMembershipDetail', { id: item.id, title: item.planName })}>
          <Card>
            <View style={styles.top}>
              <Text style={styles.title}>{item.planName}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.name}>{item.customerName}</Text>
            <Text style={styles.muted}>{item.customerPhone}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.discount}>{discountText(item)}</Text>
              <StatusBadge status={item.paymentStatus} />
            </View>
            <Text style={styles.muted}>Expires {formatDate(item.expiresOn)}</Text>
          </Card>
        </Pressable>
      )}
    />
  )
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingTop: 4, paddingBottom: 24 },
  loader: { marginTop: 24 },
  empty: { textAlign: 'center', color: COLORS.muted, marginTop: 32 },
  search: { minHeight: TOUCH_MIN, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, backgroundColor: '#fff', paddingHorizontal: 14, fontSize: 16, color: COLORS.ink },
  stopped: { opacity: 0.65 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.ink },
  name: { fontSize: 15, color: COLORS.ink, marginTop: 4 },
  muted: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  desc: { fontSize: 13, color: COLORS.ink, marginTop: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 6 },
  price: { fontSize: 18, fontWeight: '700', color: COLORS.brown },
  discount: { fontSize: 15, fontWeight: '700', color: COLORS.success },
})
