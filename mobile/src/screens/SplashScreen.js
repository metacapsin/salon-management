import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { BrandMark, GoldDivider } from '../components/Brand'
import { COLORS, FONT } from '../config/theme'

// Premium launch screen: dark brown, gold rings, the logo fading in, then the name and a quiet tagline.
// It is only a picture; App.js decides how long it stays (and never before sign-in state is known).
export default function SplashScreen() {
  const logo = useRef(new Animated.Value(0)).current
  const text = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.sequence([
      Animated.timing(logo, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(text, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start()
  }, [logo, text])

  return (
    <View style={styles.screen} accessibilityLabel="Glamora is loading">
      <View style={[styles.ring, { width: 420, height: 420, borderRadius: 210 }]} />
      <View style={[styles.ring, { width: 300, height: 300, borderRadius: 150 }]} />
      <Animated.View style={{ opacity: logo, transform: [{ scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }}>
        <BrandMark size={96} />
      </Animated.View>
      <Animated.View style={[styles.textBlock, { opacity: text, transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
        <Text style={styles.name}>Glamora</Text>
        <GoldDivider style={{ marginVertical: 12 }} />
        <Text style={styles.tagline}>Salon · Beauty · Booking</Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.espresso, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ring: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(230,199,103,0.18)' },
  textBlock: { alignItems: 'center', marginTop: 24 },
  name: { fontSize: 44, color: COLORS.gold, fontFamily: FONT.heading, fontWeight: '700', letterSpacing: 2 },
  tagline: { color: COLORS.goldSoft, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase' },
})
