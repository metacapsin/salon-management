import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchPlatformSalons } from '../../api/platformApi'
import { friendlyError } from '../../api/client'
import { FilterChips, StatusBadge } from '../../components/Chips'
import { Card, ErrorNote } from '../../components/Screen'
import { EmptyState, LoadingState } from '../../components/States'
import { COLORS, TOUCH_MIN } from '../../config/theme'

const STATUSES = [
  { value: undefined, label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
]

// Wait a little after typing stops before asking the server.
function useDebounced(value, ms = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

// Super Admin: every registered salon (name, city, owner, status). Tap one for its details.
export default function AdminSalonsScreen({ navigation }) {
  const [status, setStatus] = useState(undefined)
  const [text, setText] = useState('')
  const q = useDebounced(text.trim())

  const query = useInfiniteQuery({
    queryKey: ['platform-salons', status ?? 'all', q],
    queryFn: ({ pageParam }) => fetchPlatformSalons({ q: q || undefined, status, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page * last.meta.pageSize < last.meta.total ? last.meta.page + 1 : undefined),
  })

  const items = query.data?.pages.flatMap((p) => p.items) ?? []
  const total = query.data?.pages[0]?.meta.total

  const header = (
    <View>
      <TextInput
        accessibilityLabel="Search salons"
        value={text}
        onChangeText={setText}
        placeholder="Search name, city or owner"
        placeholderTextColor="#a8978a"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.search}
      />
      <FilterChips options={STATUSES} value={status} onChange={setStatus} inset={0} />
      {total !== undefined ? <Text style={styles.count}>{total} salons</Text> : null}
      {query.isError ? <ErrorNote message={friendlyError(query.error)} onRetry={query.refetch} /> : null}
    </View>
  )

  return (
    <FlatList
      style={styles.screen}
      data={items}
      keyExtractor={(s) => s.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={query.refetch}
      onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={query.isLoading ? <LoadingState /> : !query.isError ? <EmptyState title="No salons found" /> : null}
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={COLORS.brown} /> : null}
      renderItem={({ item }) => (
        <Pressable accessibilityRole="button" accessibilityLabel={item.name} onPress={() => navigation.navigate('SalonDetail', { id: item.id, name: item.name })}>
          <Card>
            <View style={styles.top}>
              <Text style={styles.name}>{item.name}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.muted}>{[item.city, item.state].filter(Boolean).join(', ') || 'City not set'}</Text>
            <Text style={styles.muted}>
              {item.ownerName || 'Owner not set'} · {item.memberCount} team {item.memberCount === 1 ? 'member' : 'members'}
            </Text>
            <Text style={styles.muted}>{item.publicBookingEnabled ? 'Booking page published' : 'Booking page not published'}</Text>
          </Card>
        </Pressable>
      )}
    />
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream },
  list: { padding: 16, paddingBottom: 24 },
  search: { minHeight: TOUCH_MIN, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, backgroundColor: '#fff', paddingHorizontal: 14, fontSize: 16, color: COLORS.ink },
  count: { fontSize: 13, color: COLORS.muted, marginBottom: 8 },
  loader: { marginTop: 24 },
  empty: { textAlign: 'center', color: COLORS.muted, marginTop: 32 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.ink },
  muted: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
})
