import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONT, RADIUS } from '../config/theme'

const when = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

// Gold stars for a rating, rounded to the nearest half star (an average of 4.3 shows as 4.5 stars).
export function Stars({ value, size = 16 }) {
  const rounded = Math.round(value * 2) / 2
  return (
    <View style={styles.stars} accessibilityRole="image" accessibilityLabel={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={rounded >= n ? 'star' : rounded >= n - 0.5 ? 'star-half' : 'star-outline'} size={size} color={rounded >= n - 0.5 ? COLORS.goldDeep : '#d8c7b0'} />
      ))}
    </View>
  )
}

// Average, total and the 5..1 star bars. With onPick every bar becomes a button (the owner's filter); `active` is the chosen star.
export function RatingSummary({ summary, onPick, active = null }) {
  return (
    <View style={styles.summary}>
      <View style={styles.big}>
        <Text style={styles.avg}>{summary.average.toFixed(1)}</Text>
        <Stars value={summary.average} size={18} />
        <Text style={styles.muted}>{summary.count} {summary.count === 1 ? 'review' : 'reviews'}</Text>
      </View>
      <View style={styles.bars}>
        {[5, 4, 3, 2, 1].map((star) => {
          const n = summary.breakdown[star] ?? 0
          const percent = summary.count ? (n / summary.count) * 100 : 0
          const inner = (
            <>
              <Text style={styles.starLabel}>{star} ★</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${percent}%` }]} />
              </View>
              <Text style={styles.count}>{n}</Text>
            </>
          )
          if (!onPick) return <View key={star} style={styles.barRow}>{inner}</View>
          return (
            <Pressable key={star} accessibilityRole="button" accessibilityLabel={`Show ${star} star reviews`} accessibilityState={{ selected: active === star }} onPress={() => onPick(active === star ? null : star)} style={[styles.barRow, styles.barButton, active === star && styles.barOn]}>
              {inner}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

// One review: name, date, stars, comment and the salon's reply. `children` = extra buttons at the bottom
// (customer: edit your review, owner: reply). `services` / `visit` are shown to the owner only.
// showHelpful = show the "N people found this helpful" line (owner screen and your own review; others get a button instead).
export function ReviewCard({ review, mine = false, services = [], visit, showHelpful = false, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{review.customerName?.[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {review.customerName}
            {mine ? '  (You)' : ''}
          </Text>
          <Text style={styles.muted}>{when(review.createdAt)}{review.editedAt ? ' · edited' : ''}</Text>
        </View>
        <Stars value={review.rating} size={15} />
      </View>

      {services.length > 0 || visit ? (
        <Text style={styles.muted}>{[...services, visit ? `Visit: ${when(`${visit}T00:00:00`)}` : null].filter(Boolean).join(' · ')}</Text>
      ) : null}

      {review.comment ? <Text style={styles.comment}>{review.comment}</Text> : null}

      {showHelpful && review.helpfulCount > 0 ? <Text style={styles.muted}>👍 {review.helpfulCount} {review.helpfulCount === 1 ? 'person' : 'people'} found this helpful</Text> : null}

      {review.reply ? (
        <View style={styles.reply}>
          <Text style={styles.replyHead}>Reply from the salon · {when(review.reply.repliedAt)}</Text>
          <Text style={styles.replyText}>{review.reply.text}</Text>
        </View>
      ) : null}

      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', gap: 1 },
  summary: { backgroundColor: COLORS.goldSoft, borderRadius: RADIUS.lg, padding: 14, gap: 12, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  big: { alignItems: 'center', gap: 2, minWidth: 96 },
  avg: { fontSize: 38, fontWeight: '700', color: COLORS.espresso, fontFamily: FONT.heading },
  bars: { flex: 1, minWidth: 180, gap: 2 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barButton: { minHeight: 36, paddingHorizontal: 6, borderRadius: RADIUS.sm },
  barOn: { backgroundColor: '#fff' },
  starLabel: { width: 34, fontSize: 13, fontWeight: '600', color: COLORS.ink },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: COLORS.line, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: COLORS.goldDeep, borderRadius: 4 },
  count: { width: 26, textAlign: 'right', fontSize: 13, color: COLORS.muted },
  muted: { fontSize: 13, color: COLORS.muted },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.line, padding: 14, gap: 8, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700', color: COLORS.espresso, fontSize: 16 },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  comment: { fontSize: 15, color: COLORS.ink },
  reply: { backgroundColor: COLORS.cream, borderLeftWidth: 3, borderLeftColor: COLORS.gold, borderRadius: RADIUS.sm, padding: 10, gap: 2 },
  replyHead: { fontSize: 12, fontWeight: '700', color: COLORS.goldDeep },
  replyText: { fontSize: 14, color: COLORS.ink },
})
