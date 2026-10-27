import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchCustomers } from '../../api/salonApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { FilterChips, StatusBadge } from '../../components/Chips'
import { Card, ErrorNote } from '../../components/Screen'
import { SearchBox, SummaryPanel } from '../../components/Summary'
import { EmptyState, LoadingState } from '../../components/States'
import { COLORS } from '../../config/theme'
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
      <SummaryPanel
        icon="people"
        label="Total customers"
        value={summary?.total ?? 0}
        loading={query.isLoading}
        tiles={[
          { icon: 'sparkles', label: 'New (month)', value: summary?.newThisMonth ?? 0 },
          { icon: 'repeat', label: 'Regular', value: summary?.regular ?? 0 },
          { icon: 'moon', label: 'Inactive', value: summary?.inactive ?? 0 },
        ]}
      />
      <SearchBox accessibilityLabel="Search customers" value={text} onChangeText={setText} placeholder="Search name or phone" />
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
      ListEmptyComponent={query.isLoading ? <LoadingState /> : !query.isError ? <EmptyState title="No customers found" /> : null}
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={COLORS.brown} /> : null}
      renderItem={({ item }) => (
        <Card>
          <View style={styles.top}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name?.[0]?.toUpperCase() ?? '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.muted}>{item.phone}</Text>
            </View>
            <StatusBadge status={item.segment} />
          </View>
          <View style={styles.facts}>
            <View style={styles.fact}>
              <Ionicons name="calendar-outline" size={15} color={COLORS.brown} />
              <Text style={styles.factText}>{item.visits} {item.visits === 1 ? 'visit' : 'visits'}</Text>
            </View>
            <View style={styles.fact}>
              <Ionicons name="wallet-outline" size={15} color={COLORS.brown} />
              <Text style={styles.factText}>{formatMoney(item.spent)}</Text>
            </View>
            <View style={styles.fact}>
              <Ionicons name="time-outline" size={15} color={COLORS.brown} />
              <Text style={styles.factText}>{item.lastVisit ? formatDate(item.lastVisit) : 'No visit yet'}</Text>
            </View>
          </View>
        </Card>
      )}
    />
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream },
  list: { padding: 16, paddingBottom: 24 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.goldSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.brownDark, fontSize: 17, fontWeight: '800' },
  name: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  muted: { fontSize: 13, color: COLORS.muted, marginTop: 1 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.line },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  factText: { fontSize: 13, color: COLORS.ink, fontWeight: '600' },
})
