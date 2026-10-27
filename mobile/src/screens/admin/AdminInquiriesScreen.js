import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchInquiries, INQUIRY_STATUSES } from '../../api/platformApi'
import { friendlyError } from '../../api/client'
import { FilterChips, StatusBadge } from '../../components/Chips'
import { Card, ErrorNote } from '../../components/Screen'
import { EmptyState, LoadingState } from '../../components/States'
import { COLORS, TOUCH_MIN } from '../../config/theme'

// Wait a little after typing stops before asking the server.
function useDebounced(value, ms = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export const statusLabel = (value) => INQUIRY_STATUSES.find((s) => s.value === value)?.label ?? value

const formatWhen = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

// Super Admin: messages sent from the website Contact us form. Tap one to read it, change its status and add notes.
export default function AdminInquiriesScreen({ navigation }) {
  const [status, setStatus] = useState(undefined)
  const [text, setText] = useState('')
  const q = useDebounced(text.trim())

  const query = useInfiniteQuery({
    queryKey: ['platform-inquiries', status ?? 'all', q],
    queryFn: ({ pageParam }) => fetchInquiries({ q: q || undefined, status, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page * last.meta.pageSize < last.meta.total ? last.meta.page + 1 : undefined),
  })

  const items = query.data?.pages.flatMap((p) => p.items) ?? []
  const counts = query.data?.pages[0]?.counts
  const total = query.data?.pages[0]?.meta.total

  // The chips show how many inquiries each status holds (the server counts them regardless of the filter).
  const chips = [{ value: undefined, label: counts ? `All (${counts.total})` : 'All' }, ...INQUIRY_STATUSES.map((s) => ({ value: s.value, label: counts ? `${s.label} (${counts[s.value] ?? 0})` : s.label }))]

  const header = (
    <View>
      <TextInput
        accessibilityLabel="Search inquiries"
        value={text}
        onChangeText={setText}
        placeholder="Search name, email, phone, message"
        placeholderTextColor="#a8978a"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.search}
      />
      <FilterChips options={chips} value={status} onChange={setStatus} inset={0} />
      {total !== undefined ? <Text style={styles.count}>{total} {total === 1 ? 'inquiry' : 'inquiries'} found</Text> : null}
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
      onRefresh={query.refetch}
      onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={query.isLoading ? <LoadingState /> : !query.isError ? <EmptyState title="No inquiries match" /> : null}
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={COLORS.brown} /> : null}
      renderItem={({ item }) => (
        <Pressable accessibilityRole="button" accessibilityLabel={`Inquiry from ${item.name}`} onPress={() => navigation.navigate('InquiryDetail', { id: item.id, name: item.name })}>
          <Card>
            <View style={styles.top}>
              <Text style={styles.name}>{item.name}</Text>
              <StatusBadge status={statusLabel(item.status).toLowerCase()} />
            </View>
            <Text style={styles.muted}>{formatWhen(item.createdAt)}</Text>
            <Text style={styles.preview} numberOfLines={2}>
              {item.messagePreview}
            </Text>
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
  muted: { fontSize: 13, color: COLORS.muted },
  preview: { fontSize: 14, color: COLORS.ink, marginTop: 6 },
})
