import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native'
import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchCustomers } from '../../api/salonApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { FilterChips, StatusBadge } from '../../components/Chips'
import { Card, ErrorNote, StatCard } from '../../components/Screen'
import { COLORS, TOUCH_MIN } from '../../config/theme'
import { formatDate, formatMoney } from '../../utils/formatMoney'

const SEGMENTS = [
  { value: undefined, label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'regular', label: 'Regular' },
  { value: 'inactive', label: 'Inactive' },
]

// Wait a little after typing stops before asking the server (so we do not search on every letter).
function useDebounced(value, ms = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

// Customers are read-only here (the server has no customer write API; they come from appointments).
export default function CustomersScreen() {
  const { activeSalonId } = useAuth()
  const [segment, setSegment] = useState(undefined)
  const [text, setText] = useState('')
  const search = useDebounced(text.trim())

  const query = useInfiniteQuery({
    queryKey: ['customers', activeSalonId, segment ?? 'all', search],
    queryFn: ({ pageParam }) => fetchCustomers({ search: search || undefined, segment, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page * last.meta.pageSize < last.meta.total ? last.meta.page + 1 : undefined),
  })

  const items = query.data?.pages.flatMap((p) => p.items) ?? []
  const summary = query.data?.pages[0]?.summary

  const header = (
    <View>
      <View style={styles.stats}>
        <StatCard label="Customers" value={summary?.total} loading={query.isLoading} />
        <StatCard label="New this month" value={summary?.newThisMonth} loading={query.isLoading} />
        <StatCard label="Regular" value={summary?.regular} loading={query.isLoading} />
        <StatCard label="Inactive" value={summary?.inactive} loading={query.isLoading} />
      </View>
      <TextInput
        accessibilityLabel="Search customers"
        value={text}
        onChangeText={setText}
        placeholder="Search name or phone"
        placeholderTextColor="#a8978a"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.search}
      />
      <FilterChips options={SEGMENTS} value={segment} onChange={setSegment} inset={0} />
      {query.isError ? <ErrorNote message={friendlyError(query.error)} onRetry={query.refetch} /> : null}
    </View>
  )

  return (
    <FlatList
      style={styles.screen}
      data={items}
      keyExtractor={(c) => c.phone}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={query.refetch}
      onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={query.isLoading ? <ActivityIndicator style={styles.loader} color={COLORS.brown} /> : !query.isError ? <Text style={styles.empty}>No customers found.</Text> : null}
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={COLORS.brown} /> : null}
      renderItem={({ item }) => (
        <Card>
          <View style={styles.top}>
            <Text style={styles.name}>{item.name}</Text>
            <StatusBadge status={item.segment} />
          </View>
          <Text style={styles.muted}>{item.phone}</Text>
          <Text style={styles.muted}>
            {item.visits} visits · {formatMoney(item.spent)} spent
          </Text>
          <Text style={styles.muted}>Last visit: {formatDate(item.lastVisit)}</Text>
        </Card>
      )}
    />
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream },
  list: { padding: 16, paddingBottom: 24 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  search: { minHeight: TOUCH_MIN, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, backgroundColor: '#fff', paddingHorizontal: 14, fontSize: 16, color: COLORS.ink },
  loader: { marginTop: 24 },
  empty: { textAlign: 'center', color: COLORS.muted, marginTop: 32 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.ink },
  muted: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
})
