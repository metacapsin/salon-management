import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { editReview, fetchReviewContext, submitReview } from '../../api/publicApi'
import { friendlyError } from '../../api/client'
import Button from '../../components/Button'
import { Stars } from '../../components/Reviews'
import { Card, Screen } from '../../components/Screen'
import { ErrorBanner, ErrorState, LoadingState } from '../../components/States'
import TextField from '../../components/TextField'
import { COLORS, FONT } from '../../config/theme'

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']

const when = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

// 1-5 stars, each one a big tappable button.
function StarPicker({ value, onChange }) {
  return (
    <View style={styles.pickerRow} accessibilityRole="radiogroup" accessibilityLabel="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} accessibilityRole="radio" accessibilityState={{ checked: value === n }} accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} onPress={() => onChange(n)} hitSlop={4} style={styles.starBtn}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={38} color={n <= value ? COLORS.goldDeep : '#d8c7b0'} />
        </Pressable>
      ))}
      <Text style={styles.pickLabel}>{LABELS[value]}</Text>
    </View>
  )
}

// Write a new review or change your own (rating + comment).
function ReviewForm({ data, bookingId, navigation }) {
  const queryClient = useQueryClient()
  const existing = data.review
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [comment, setComment] = useState(existing?.comment ?? '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(null)

  const save = useMutation({
    mutationFn: async () => {
      let review = existing
      if (!review) review = await submitReview(bookingId, { rating, comment })
      else if (rating !== review.rating || comment !== review.comment) review = await editReview(review.id, { rating, comment })
      return { review }
    },
    onSuccess: (result) => {
      setSaved(result)
      queryClient.invalidateQueries({ queryKey: ['public'] })
    },
    onError: (e) => setError(friendlyError(e)),
  })

  function submit() {
    if (rating < 1) return setError('Please choose a star rating.')
    setError('')
    save.mutate()
  }

  if (saved) {
    return (
      <Screen>
        <Card style={styles.done}>
          <Text style={styles.party}>🎉</Text>
          <Text style={styles.doneTitle}>Thank you for your review!</Text>
          <Stars value={saved.review.rating} size={28} />
          <Text style={styles.muted}>Your feedback helps others discover great salons.</Text>
          <Button title="Done" onPress={() => navigation.goBack()} style={{ alignSelf: 'stretch' }} />
        </Card>
      </Screen>
    )
  }

  const b = data.booking
  return (
    <Screen>
      <Card>
        <Text style={styles.salon}>{b.salonName}</Text>
        <Text style={styles.muted}>{b.services.join(', ')} · {when(b.date)}</Text>
      </Card>

      <ErrorBanner message={error} />

      <Text style={styles.label}>How was your experience?</Text>
      <StarPicker value={rating} onChange={setRating} />

      <View style={{ height: 16 }} />
      <TextField label="Write your review (optional)" placeholder="What did you like? How was the service and the staff?" value={comment} onChangeText={setComment} multiline maxLength={1000} />
      <Text style={[styles.muted, styles.counter]}>{comment.length}/1000</Text>

      <View style={{ height: 8 }} />

      <Button title={existing ? 'Save changes' : 'Submit Review'} icon="checkmark" loading={save.isPending} onPress={submit} />
    </Screen>
  )
}

// Opens from a notification, from "My appointments" or from a salon page ("Edit your review").
export default function ReviewScreen({ route, navigation }) {
  const { bookingId } = route.params
  const query = useQuery({ queryKey: ['public', 'review-context', bookingId], queryFn: () => fetchReviewContext(bookingId), staleTime: 0, gcTime: 0 })
  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState offline={query.error?.status === 0} message={friendlyError(query.error)} onRetry={query.refetch} />
  const data = query.data
  if (!data.canReview && !data.review) {
    return (
      <Screen>
        <ErrorBanner message="You can review an appointment once it is completed." />
        <Button title="Close" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    )
  }
  return <ReviewForm data={data} bookingId={bookingId} navigation={navigation} />
}

const styles = StyleSheet.create({
  salon: { fontSize: 18, fontWeight: '700', color: COLORS.ink, fontFamily: FONT.heading },
  muted: { fontSize: 13, color: COLORS.muted },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.ink, marginBottom: 6 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  starBtn: { minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  pickLabel: { marginLeft: 8, fontSize: 15, fontWeight: '700', color: COLORS.brownDark },
  counter: { marginTop: -10, marginBottom: 16, textAlign: 'right' },
  done: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  party: { fontSize: 44 },
  doneTitle: { fontSize: 20, fontWeight: '700', color: COLORS.ink, fontFamily: FONT.heading, textAlign: 'center' },
})
