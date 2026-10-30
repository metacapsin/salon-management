import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMyNotifications, markAllNotificationsRead, markNotificationRead } from '../../api/publicApi'
import { friendlyError } from '../../api/client'
import Button from '../../components/Button'
import { EmptyState, ErrorState, LoadingState } from '../../components/States'
import { COLORS, FONT, RADIUS } from '../../config/theme'

export const NOTIFICATIONS_KEY = ['public', 'notifications']

function timeAgo(iso) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// The customer's own notifications: "rate your visit" after a completed appointment, and "thanks" after a review.
// Opening one marks it read; review ones continue to the review screen.
export default function NotificationsScreen({ navigation }) {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: NOTIFICATIONS_KEY, queryFn: fetchMyNotifications, refetchInterval: 60_000 })
  const refresh = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })
  const markOne = useMutation({ mutationFn: markNotificationRead, onSuccess: refresh })
  const markAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh })

  const items = query.data?.notifications ?? []
  const unread = query.data?.unreadCount ?? 0

  function open(n) {
    if (n.unread) markOne.mutate(n.id)
    if (n.canReview || n.type === 'review_submitted') navigation.navigate('Review', { bookingId: n.bookingId })
  }

  let empty
  if (query.isLoading) empty = <LoadingState />
  else if (query.isError) empty = <ErrorState offline={query.error?.status === 0} message={friendlyError(query.error)} onRetry={query.refetch} />
  else empty = <EmptyState icon="notifications-outline" title="No notifications yet" text="After a salon completes your appointment, you can rate your visit here." />

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(n) => String(n.id)}
      ListHeaderComponent={unread > 0 ? <Button title="Mark all as read" variant="secondary" loading={markAll.isPending} onPress={() => markAll.mutate()} style={styles.markAll} /> : null}
      renderItem={({ item: n }) => {
        const actionable = n.canReview || n.type === 'review_submitted'
        return (
          <Pressable accessibilityRole={actionable ? 'button' : 'text'} accessibilityLabel={`${n.title}. ${n.unread ? 'Unread' : 'Read'}`} onPress={() => open(n)} style={[styles.card, n.unread && styles.unread]}>
            <View style={styles.head}>
              <Text style={styles.title}>{n.title}</Text>
              {n.unread ? <View style={styles.dot} accessibilityLabel="Unread" /> : null}
            </View>
            <Text style={styles.body}>{n.body}</Text>
            <View style={styles.foot}>
              <Text style={styles.muted}>{timeAgo(n.createdAt)}</Text>
              {n.canReview ? <Text style={styles.action}>Write a review ›</Text> : null}
              {n.type === 'review_submitted' ? <Text style={styles.action}>View / edit ›</Text> : null}
              {n.type === 'review_request' && !n.canReview ? <Text style={styles.done}>Reviewed ✓</Text> : null}
            </View>
          </Pressable>
        )
      }}
      ListEmptyComponent={empty}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} tintColor={COLORS.brown} />}
    />
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream },
  content: { padding: 16, paddingBottom: 32 },
  markAll: { marginBottom: 12 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.line, padding: 14, marginBottom: 12, gap: 6 },
  unread: { backgroundColor: '#fff8e6', borderColor: COLORS.gold },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.ink, fontFamily: FONT.heading },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.goldDeep },
  body: { fontSize: 14, color: COLORS.muted },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 28 },
  muted: { fontSize: 12, color: COLORS.muted },
  action: { fontSize: 14, fontWeight: '700', color: COLORS.brown },
  done: { fontSize: 13, fontWeight: '700', color: COLORS.success },
})
