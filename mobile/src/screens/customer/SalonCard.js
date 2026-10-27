import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONT, RADIUS } from '../../config/theme'
import { formatMoney } from '../../utils/formatMoney'

// One salon in a list: photo (or a monogram), rating, offer, name, place and distance, a few service tags, starting price.
// Only data the server really has is shown; a missing piece is simply left out.
export default function SalonCard({ salon, onPress }) {
  const [imageFailed, setImageFailed] = useState(false)
  const place = [salon.area, salon.city].filter(Boolean).join(', ')
  const rated = salon.rating?.count > 0
  const tags = (salon.tags ?? []).slice(0, 3)
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${salon.name}, open salon`} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View>
        {salon.coverUrl && !imageFailed ? (
          <Image source={{ uri: salon.coverUrl }} style={styles.cover} onError={() => setImageFailed(true)} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.cover, styles.placeholder]}>
            <Text style={styles.initial}>{salon.name?.[0]?.toUpperCase() ?? 'G'}</Text>
          </View>
        )}
        <View style={styles.rating}>
          <Ionicons name="star" size={12} color={COLORS.goldDeep} />
          <Text style={styles.ratingText}>{rated ? `${salon.rating.average.toFixed(1)} (${salon.rating.count})` : 'New'}</Text>
        </View>
        {salon.offer ? (
          <View style={styles.offer}>
            <Text style={styles.offerText}>{salon.offer.text}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{salon.name}</Text>
        {place ? (
          <View style={styles.row}>
            <Ionicons name="location-outline" size={14} color={COLORS.muted} />
            <Text style={styles.place} numberOfLines={1}>{place}{salon.distanceKm != null ? `  ·  ${salon.distanceKm} km` : ''}</Text>
          </View>
        ) : null}
        {tags.length > 0 ? (
          <View style={styles.tags}>
            {tags.map((t) => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText} numberOfLines={1}>{t}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.footer}>
          <Text style={styles.price}>{salon.startingPrice != null ? `From ${formatMoney(salon.startingPrice)}` : 'Price on request'}</Text>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>View & book</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.brown} />
          </View>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden', marginBottom: 16 },
  pressed: { opacity: 0.92 },
  cover: { width: '100%', height: 168, backgroundColor: COLORS.espresso },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 52, fontWeight: '700', color: COLORS.gold, fontFamily: FONT.heading },
  rating: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.surface, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 },
  ratingText: { fontSize: 12, fontWeight: '700', color: COLORS.ink },
  offer: { position: 'absolute', left: 12, bottom: 12, backgroundColor: COLORS.gold, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 4 },
  offerText: { color: COLORS.espresso, fontWeight: '800', fontSize: 12 },
  body: { padding: 14 },
  name: { fontSize: 18, fontWeight: '700', color: COLORS.ink, fontFamily: FONT.heading },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  place: { flex: 1, fontSize: 13, color: COLORS.muted },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { backgroundColor: COLORS.goldSoft, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4, maxWidth: '100%' },
  tagText: { fontSize: 12, color: COLORS.ink, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.line },
  price: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  cta: { flexDirection: 'row', alignItems: 'center', minHeight: 32 },
  ctaText: { fontSize: 14, fontWeight: '700', color: COLORS.brown },
})
