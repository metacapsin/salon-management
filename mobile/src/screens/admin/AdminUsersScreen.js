import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchPlatformUsers } from '../../api/platformApi'
import { friendlyError } from '../../api/client'
import { StatusBadge } from '../../components/Chips'
import { Card, ErrorNote } from '../../components/Screen'
import { EmptyState, LoadingState } from '../../components/States'
import { COLORS, TOUCH_MIN } from '../../config/theme'
import { formatDate } from '../../utils/formatMoney'

// Wait a little after typing stops before asking the server.
function useDebounced(value, ms = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

const statusOf = (u) => (!u.active ? 'deactivated' : u.verified ? 'verified' : 'not verified')

// Super Admin: everyone on the platform and which salon each person works in, with what role. Read only.
export default function AdminUsersScreen({ navigation }) {
  const [text, setText] = useState('')
  const q = useDebounced(text.trim())

  const query = useInfiniteQuery({
    queryKey: ['platform-users', q],
    queryFn: ({ pageParam }) => fetchPlatformUsers({ q: q || undefined, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page * last.meta.pageSize < last.meta.total ? last.meta.page + 1 : undefined),
  })

  const items = query.data?.pages.flatMap((p) => p.items) ?? []
  const total = query.data?.pages[0]?.meta.total

  const header = (
    <View>
      <TextInput
        accessibilityLabel="Search users"
        value={text}
        onChangeText={setText}
        placeholder="Search name or email"
        placeholderTextColor="#a8978a"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.search}
      />
      {total !== undefined ? <Text style={styles.count}>{total} {total === 1 ? 'user' : 'users'}</Text> : <View style={styles.countGap} />}
      {query.isError ? <ErrorNote message={friendlyError(query.error)} onRetry={query.refetch} /> : null}
    </View>
  )

  return (
    <FlatList
      style={styles.screen}
      data={items}
      keyExtractor={(u) => u.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={query.refetch}
      onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={query.isLoading ? <LoadingState /> : !query.isError ? <EmptyState title="No users found" /> : null}
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={COLORS.brown} /> : null}
      renderItem={({ item }) => (
        <Card>
          <View style={styles.top}>
            <Text style={styles.name}>{item.name}</Text>
            <StatusBadge status={statusOf(item)} />
          </View>
          <Text style={styles.muted}>{item.email}</Text>
          {item.platformRole === 'admin' ? <Text style={styles.admin}>Super Admin</Text> : null}
          {item.salons.length === 0 ? (
            <Text style={styles.muted}>Not in any salon</Text>
          ) : (
            item.salons.map((s) => (
              <Pressable
                key={s.salonId}
                accessibilityRole="button"
                accessibilityLabel={`${s.salonName} salon`}
                onPress={() => navigation.navigate('SalonDetail', { id: s.salonId, name: s.salonName })}
                style={styles.salonRow}
              >
                <Text style={styles.salonName}>{s.salonName}</Text>
                <Text style={styles.role}>{s.role}</Text>
              </Pressable>
            ))
          )}
          <Text style={styles.muted}>Joined {formatDate(new Date(item.createdAt).toLocaleDateString('en-CA'))}</Text>
        </Card>
      )}
    />
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream },
  list: { padding: 16, paddingBottom: 24 },
  search: { minHeight: TOUCH_MIN, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, backgroundColor: '#fff', paddingHorizontal: 14, fontSize: 16, color: COLORS.ink },
  count: { fontSize: 13, color: COLORS.muted, marginVertical: 8 },
  countGap: { height: 12 },
  loader: { marginTop: 24 },
  empty: { textAlign: 'center', color: COLORS.muted, marginTop: 32 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.ink },
  muted: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  admin: { fontSize: 13, fontWeight: '600', color: COLORS.brown, marginTop: 2 },
  salonRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: COLORS.line, marginTop: 8 },
  salonName: { flex: 1, fontSize: 14, color: COLORS.ink },
  role: { fontSize: 12, fontWeight: '600', color: COLORS.brownDark, backgroundColor: '#efe6db', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, textTransform: 'capitalize' },
})
