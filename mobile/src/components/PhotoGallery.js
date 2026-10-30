import { useState } from 'react'
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../config/theme'

// Salon photos: swipe left/right to see the next one, dots show where you are. One photo (or none) looks like a plain cover.
// `photos` = list of image links, `name` = salon name (monogram when there is no photo), `height` = cover height.
export default function PhotoGallery({ photos = [], name = '', height = 168 }) {
  const [width, setWidth] = useState(0)
  const [page, setPage] = useState(0)
  const [failed, setFailed] = useState([])
  const shown = photos.filter((u) => !failed.includes(u))

  if (shown.length === 0) {
    return (
      <View style={[styles.box, styles.placeholder, { height }]}>
        <Text style={styles.initial}>{name?.[0]?.toUpperCase() ?? 'G'}</Text>
      </View>
    )
  }

  return (
    <View style={[styles.box, { height }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={shown.length > 1}
        onMomentumScrollEnd={(e) => width && setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {shown.map((uri) => (
          <Image key={uri} source={{ uri }} style={{ width: width || '100%', height }} resizeMode="contain" onError={() => setFailed((f) => [...f, uri])} accessibilityIgnoresInvertColors />
        ))}
      </ScrollView>
      {shown.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {shown.map((uri, i) => (
            <View key={uri} style={[styles.dot, i === Math.min(page, shown.length - 1) && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { width: '100%', backgroundColor: COLORS.espresso, overflow: 'hidden' },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.goldSoft },
  initial: { fontSize: 48, color: COLORS.goldDeep, fontWeight: '700' },
  dots: { position: 'absolute', bottom: 8, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotOn: { backgroundColor: '#fff' },
})
