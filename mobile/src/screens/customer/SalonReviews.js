import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchSalonReviews, setReviewHelpful } from '../../api/publicApi'
import { friendlyError } from '../../api/client'
import Button from '../../components/Button'
import { RatingSummary, ReviewCard } from '../../components/Reviews'
import { ErrorNote } from '../../components/Screen'
import { COLORS, FONT, RADIUS } from '../../config/theme'

// "Helpful" under someone else's review; tap again to take it back. The count always comes from the server.
function HelpfulButton({ review, salonId }) {
  const queryClient = useQueryClient()
  const toggle = useMutation({
    mutationFn: () => setReviewHelpful(review.id, !review.isHelpful),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['public', 'reviews', salonId] }),
  })
  const on = review.isHelpful
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={on ? 'Helpful, tap to undo' : 'Mark as helpful'} accessibilityState={{ selected: on, busy: toggle.isPending }} onPress={() => !toggle.isPending && toggle.mutate()} style={[styles.helpful, on && styles.helpfulOn]}>
      <Ionicons name={on ? 'thumbs-up' : 'thumbs-up-outline'} size={16} color={on ? '#fff' : COLORS.brown} />
      <Text style={[styles.helpfulText, on && { color: '#fff' }]}>Helpful{review.helpfulCount > 0 ? ` (${review.helpfulCount})` : ''}</Text>
    </Pressable>
  )
}

// "Ratings and reviews" on a salon page: the real average, the 5..1 star bars and the customers' reviews (5 at a time).
// A review with no data yet just says so; nothing here is made up.
export default function SalonReviews({ salonId, onEdit }) {
  const query = useInfiniteQuery({
    queryKey: ['public', 'reviews', salonId],
    queryFn: ({ pageParam }) => fetchSalonReviews(salonId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  })
  const first = query.data?.pages[0]
  const reviews = query.data?.pages.flatMap((p) => p.reviews) ?? []

  return (
    <View style={styles.block}>
      <Text style={styles.section}>Ratings and reviews</Text>
      {query.isLoading ? <Text style={styles.muted}>Loading reviews…</Text> : null}
      {query.isError ? <ErrorNote message={friendlyError(query.error)} onRetry={query.refetch} /> : null}
      {first && first.summary.count === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.muted}>No reviews yet. Reviews appear here after customers complete an appointment and share their experience.</Text>
        </View>
      ) : null}
      {first && first.summary.count > 0 ? (
        <>
          <RatingSummary summary={first.summary} />
          <View style={{ height: 12 }} />
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} mine={r.isMine} showHelpful={r.isMine}>
              {r.isMine ? <Button title="Edit your review" variant="secondary" onPress={() => onEdit(r.bookingId)} /> : <HelpfulButton review={r} salonId={salonId} />}
            </ReviewCard>
          ))}
          {query.hasNextPage ? <Button title="Show more reviews" variant="secondary" loading={query.isFetchingNextPage} onPress={() => query.fetchNextPage()} /> : null}
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  block: { marginTop: 22 },
  section: { fontSize: 18, fontWeight: '700', color: COLORS.ink, fontFamily: FONT.heading, marginBottom: 8 },
  muted: { fontSize: 13, color: COLORS.muted },
  empty: { backgroundColor: COLORS.goldSoft, borderRadius: RADIUS.md, padding: 12 },
  helpful: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 14, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.brown, backgroundColor: COLORS.surface },
  helpfulOn: { backgroundColor: COLORS.brown },
  helpfulText: { fontSize: 14, fontWeight: '600', color: COLORS.brown },
})
