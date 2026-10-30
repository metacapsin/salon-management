import { useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchReviews, removeReviewReply, replyToReview } from '../../api/salonApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { roleCan } from '../../auth/permissions'
import Button from '../../components/Button'
import { FilterChips } from '../../components/Chips'
import { RatingSummary, ReviewCard } from '../../components/Reviews'
import { EmptyState, ErrorBanner, ErrorState, LoadingState } from '../../components/States'
import TextField from '../../components/TextField'
import { COLORS } from '../../config/theme'

// Write or change the salon's reply under one review.
function ReplyBox({ review, onDone }) {
  const [text, setText] = useState(review.reply?.text ?? '')
  const [error, setError] = useState('')
  const save = useMutation({ mutationFn: () => replyToReview(review.id, text.trim()), onSuccess: onDone, onError: (e) => setError(friendlyError(e)) })
  return (
    <View style={{ marginTop: 4 }}>
      <ErrorBanner message={error} />
      <TextField label="Your reply" value={text} onChangeText={setText} multiline maxLength={500} autoFocus />
      <Text style={styles.hint}>{text.length}/500. Everyone who opens your salon can see this reply.</Text>
      <View style={styles.row}>
        <Button title="Cancel" variant="secondary" onPress={onDone} disabled={save.isPending} style={styles.half} />
        <Button title="Post reply" loading={save.isPending} disabled={text.trim().length === 0} onPress={() => save.mutate()} style={styles.half} />
      </View>
    </View>
  )
}

function OwnerReview({ review, canReply, onChanged }) {
  const [replying, setReplying] = useState(false)
  const [error, setError] = useState('')
  const remove = useMutation({ mutationFn: () => removeReviewReply(review.id), onSuccess: onChanged, onError: (e) => setError(friendlyError(e)) })
  const done = () => {
    setReplying(false)
    onChanged()
  }
  return (
    <ReviewCard review={review} services={review.services} visit={review.visitDate} showHelpful>
      {!review.comment ? <Text style={styles.hint}>No written feedback, rating only.</Text> : null}
      <ErrorBanner message={error} />
      {replying ? (
        <ReplyBox review={review} onDone={done} />
      ) : canReply ? (
        <View style={styles.row}>
          <Button title={review.reply ? 'Edit reply' : 'Reply'} icon="chatbubble-outline" variant="secondary" onPress={() => setReplying(true)} style={styles.half} />
          {review.reply ? <Button title="Delete reply" variant="danger" loading={remove.isPending} onPress={() => remove.mutate()} style={styles.half} /> : null}
        </View>
      ) : null}
    </ReviewCard>
  )
}

const FILTERS = [{ value: null, label: 'All' }, ...[5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${n} ★` }))]

// The salon's reviews: average, 5..1 star bars (tap one to filter), latest reviews and replies.
// Owner/Manager only; the server returns just this salon's reviews.
export default function ReviewsScreen() {
  const { role, activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const canReply = roleCan(role, 'reviews.reply')
  const [rating, setRating] = useState(null)
  const query = useInfiniteQuery({
    queryKey: ['reviews', activeSalonId, rating],
    queryFn: ({ pageParam }) => fetchReviews({ page: pageParam, rating }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  })
  const first = query.data?.pages[0]
  const reviews = query.data?.pages.flatMap((p) => p.reviews) ?? []
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['reviews', activeSalonId] })

  let empty = null
  if (query.isLoading) empty = <LoadingState />
  else if (query.isError) empty = <ErrorState offline={query.error?.status === 0} message={friendlyError(query.error)} onRetry={query.refetch} />
  else if (first && first.summary.count === 0) empty = <EmptyState icon="star-outline" title="No reviews yet" text="Customers get a review request after you mark an appointment as Completed." />
  else if (first && reviews.length === 0) empty = <EmptyState icon="star-outline" title={`No ${rating} star reviews`} />

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={reviews}
      keyExtractor={(r) => String(r.id)}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        first && first.summary.count > 0 ? (
          <View style={{ marginBottom: 12, gap: 10 }}>
            <RatingSummary summary={first.summary} active={rating} onPick={setRating} />
            <FilterChips options={FILTERS} value={rating} onChange={setRating} inset={0} />
          </View>
        ) : null
      }
      renderItem={({ item }) => <OwnerReview review={item} canReply={canReply} onChanged={refresh} />}
      ListEmptyComponent={empty}
      onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
      onEndReachedThreshold={0.4}
      refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={query.refetch} tintColor={COLORS.brown} />}
    />
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream },
  content: { padding: 16, paddingBottom: 32 },
  row: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  hint: { fontSize: 13, color: COLORS.muted, marginBottom: 8 },
})
