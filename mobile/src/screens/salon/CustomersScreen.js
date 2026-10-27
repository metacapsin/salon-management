import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchCustomers } from '../../api/salonApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { FilterChips, StatusBadge } from '../../components/Chips'
import { Card, ErrorNote } from '../../components/Screen'
import { EmptyState, LoadingState } from '../../components/States'
import { COLORS, FONT, RADIUS, SHADOW, TOUCH_MIN } from '../../config/theme'
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

// Dark summary panel: total customers big, then the three groups as small tiles.
function Summary({ summary, loading }) {
  const tiles = [
    { icon: 'sparkles', label: 'New (month)', value: summary?.newThisMonth },
    { icon: 'repeat', label: 'Regular', value: summary?.regular },
    { icon: 'moon', label: 'Inactive', value: summary?.inactive },
  ]
  return (
    <View style={styles.summary}>
      <View style={styles.summaryTop}>
        <View>
          <Text style={styles.totalValue}>{loading ? '…' : (summary?.total ?? 0)}</Text>
          <Text style={styles.totalLabel}>Total customers</Text>
        </View>
        <View style={styles.totalIcon}>
          <Ionicons name="people" size={26} color={COLORS.espresso} />
        </View>
      </View>
      <View style={styles.tiles}>
        {tiles.map((t) => (
          <View key={t.label} style={styles.tile}>
            <View style={styles.tileHead}>
              <Ionicons name={t.icon} size={14} color={COLORS.gold} />
              <Text style={styles.tileValue}>{loading ? '…' : (t.value ?? 0)}</Text>
            </View>
            <Text style={styles.tileLabel} numberOfLines={1}>{t.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
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
      <Summary summary={summary} loading={query.isLoading} />
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color={COLORS.muted} />
        <TextInput
          accessibilityLabel="Search customers"
          value={text}
          onChangeText={setText}
          placeholder="Search name or phone"
          placeholderTextColor="#a8978a"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
      </View>
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
  summary: { backgroundColor: COLORS.espresso, borderRadius: RADIUS.xl, padding: 18, marginBottom: 14, ...SHADOW },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalValue: { color: COLORS.gold, fontSize: 40, fontWeight: '700', fontFamily: FONT.heading },
  totalLabel: { color: COLORS.goldSoft, fontSize: 14, marginTop: -2 },
  totalIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  tiles: { flexDirection: 'row', gap: 10, marginTop: 16 },
  tile: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(230,199,103,0.25)', paddingVertical: 10, paddingHorizontal: 12 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileValue: { color: COLORS.cream, fontSize: 20, fontWeight: '700' },
  tileLabel: { color: COLORS.goldSoft, fontSize: 12, marginTop: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: TOUCH_MIN, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, paddingHorizontal: 14 },
  searchInput: { flex: 1, minHeight: TOUCH_MIN - 2, fontSize: 16, color: COLORS.ink, paddingVertical: 0, outlineStyle: 'none' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.goldSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.brownDark, fontSize: 17, fontWeight: '800' },
  name: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  muted: { fontSize: 13, color: COLORS.muted, marginTop: 1 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.line },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  factText: { fontSize: 13, color: COLORS.ink, fontWeight: '600' },
})
