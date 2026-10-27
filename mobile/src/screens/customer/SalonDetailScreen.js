import { useEffect, useMemo, useState } from 'react'
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { fetchSalon, recordSalonView } from '../../api/publicApi'
import { friendlyError } from '../../api/client'
import Button from '../../components/Button'
import { Ionicons } from '@expo/vector-icons'
import { ErrorState, LoadingState } from '../../components/States'
import { COLORS, FONT, RADIUS } from '../../config/theme'
import { formatDate, formatMoney } from '../../utils/formatMoney'

// Google Maps directions: by the saved location (lat/lng) when the salon has one, otherwise by its address text.
// This https link opens the Maps app on a phone and Google Maps in a browser.
function directionsUrl(salon) {
  const destination = salon.location ? `${salon.location.lat},${salon.location.lng}` : salon.address
  return destination ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}` : null
}

export const offerText = (o) => (o.discountType === 'percent' ? `${o.discountValue}% OFF` : `${formatMoney(o.discountValue)} OFF`)

// Salon page for a customer: photo, rating, address, running offers and the price list. Pick services, then continue to booking.
export default function SalonDetailScreen({ route, navigation }) {
  const { id } = route.params
  const insets = useSafeAreaInsets()
  const [picked, setPicked] = useState([])
  const [imageFailed, setImageFailed] = useState(false)
  const [mapError, setMapError] = useState('')
  const salon = useQuery({ queryKey: ['public', 'salon', id], queryFn: () => fetchSalon(id) })

  useEffect(() => {
    recordSalonView(id)
  }, [id])

  const data = salon.data
  const chosen = useMemo(() => (data?.services ?? []).filter((s) => picked.includes(s.id)), [data, picked])
  const total = chosen.reduce((sum, s) => sum + s.price, 0)
  const minutes = chosen.reduce((sum, s) => sum + s.durationMin, 0)

  const toggle = (serviceId) => setPicked((p) => (p.includes(serviceId) ? p.filter((x) => x !== serviceId) : p.length >= 8 ? p : [...p, serviceId]))

  if (salon.isLoading) return <LoadingState label="Loading salon" />
  if (salon.isError || !data) {
    return <ErrorState offline={salon.error?.status === 0} message={salon.error?.status === 404 ? 'This salon is not available.' : friendlyError(salon.error)} onRetry={salon.refetch} />
  }

  const groups = (data.services ?? []).reduce((acc, s) => {
    ;(acc[s.category || 'Other'] ??= []).push(s)
    return acc
  }, {})
  const rated = data.rating?.count > 0

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}>
        {data.coverUrl && !imageFailed ? (
          <Image source={{ uri: data.coverUrl }} style={styles.cover} onError={() => setImageFailed(true)} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.cover, styles.placeholder]}>
            <Text style={styles.initial}>{data.name?.[0]?.toUpperCase() ?? 'G'}</Text>
          </View>
        )}

        <View style={styles.pad}>
          <Text style={styles.name}>{data.name}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={15} color={COLORS.goldDeep} />
            <Text style={styles.rating}>{rated ? `${data.rating.average.toFixed(1)} (${data.rating.count} ratings)` : 'New · no ratings yet'}</Text>
          </View>
          {data.about ? <Text style={styles.about}>{data.about}</Text> : null}
          {data.address ? (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color={COLORS.brown} />
              <Text style={styles.line}>{data.address}</Text>
            </View>
          ) : null}
          {directionsUrl(data) ? (
            <View style={styles.dirBtn}>
              <Button
                title="Get directions"
                icon="navigate-outline"
                variant="secondary"
                onPress={() => {
                  setMapError('')
                  Linking.openURL(directionsUrl(data)).catch(() => setMapError('Could not open Maps on this device.'))
                }}
              />
              {mapError ? <Text style={styles.mapError}>{mapError}</Text> : null}
            </View>
          ) : null}
          {data.owner?.phone ? (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color={COLORS.brown} />
              <Text style={styles.line}>+91 {data.owner.phone}</Text>
            </View>
          ) : null}

          {data.offers?.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.section}>Offers</Text>
              {data.offers.map((o) => (
                <View key={o.id} style={styles.offer}>
                  <Text style={styles.offerBadge}>{offerText(o)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.offerTitle}>{o.title}</Text>
                    <Text style={styles.muted}>Until {formatDate(o.endsOn)}{o.oncePerCustomer ? ' · once per customer' : ''}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.block}>
            <Text style={styles.section}>Services</Text>
            {Object.keys(groups).length === 0 ? <Text style={styles.muted}>This salon has not listed services yet.</Text> : null}
            {Object.entries(groups).map(([category, list]) => (
              <View key={category}>
                <Text style={styles.category}>{category}</Text>
                {list.map((s) => {
                  const on = picked.includes(s.id)
                  return (
                    <Pressable key={s.id} onPress={() => toggle(s.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${s.name}, ${formatMoney(s.price)}`} style={[styles.service, on && styles.serviceOn]}>
                      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? COLORS.brown : COLORS.muted} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.serviceName}>{s.name}</Text>
                        <Text style={styles.muted}>{s.durationMin} min{s.atHome && !s.atSalon ? ' · at home' : s.atHome ? ' · salon or home' : ''}</Text>
                      </View>
                      <Text style={styles.price}>{formatMoney(s.price)}</Text>
                    </Pressable>
                  )
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: 12 + insets.bottom }]}>
        <Text style={styles.barText}>{chosen.length === 0 ? 'Choose services to book' : `${chosen.length} selected · ${minutes} min · ${formatMoney(total)}`}</Text>
        <Button title="Book appointment" icon="calendar-outline" disabled={chosen.length === 0} onPress={() => navigation.navigate('Book', { salon: data, serviceIds: picked })} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream },
  loader: { marginTop: 60 },
  center: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: COLORS.cream, gap: 16 },
  cover: { width: '100%', height: 220, backgroundColor: COLORS.espresso },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 56, fontWeight: '700', color: COLORS.gold, fontFamily: FONT.heading },
  pad: { padding: 16, marginTop: -20, backgroundColor: COLORS.cream, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl },
  name: { fontSize: 24, fontWeight: '700', color: COLORS.ink, fontFamily: FONT.heading },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  rating: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  dirBtn: { marginTop: 12 },
  mapError: { marginTop: 6, fontSize: 13, color: COLORS.error },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  about: { marginTop: 10, fontSize: 14, color: COLORS.muted },
  line: { flex: 1, fontSize: 14, color: COLORS.ink },
  block: { marginTop: 22 },
  section: { fontSize: 18, fontWeight: '700', color: COLORS.ink, fontFamily: FONT.heading, marginBottom: 8 },
  category: { marginTop: 10, marginBottom: 6, fontSize: 13, fontWeight: '700', color: COLORS.brown, textTransform: 'uppercase' },
  muted: { fontSize: 13, color: COLORS.muted },
  offer: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.goldSoft, borderRadius: RADIUS.md, padding: 12, marginBottom: 8 },
  offerBadge: { backgroundColor: COLORS.gold, color: COLORS.espresso, fontWeight: '700', fontSize: 12, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden' },
  offerTitle: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
  service: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.line, padding: 12, marginBottom: 8 },
  serviceOn: { borderColor: COLORS.brown, backgroundColor: COLORS.goldSoft },
  check: { fontSize: 22, color: COLORS.brown },
  serviceName: { fontSize: 15, fontWeight: '600', color: COLORS.ink },
  price: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: COLORS.cream, borderTopWidth: 1, borderTopColor: COLORS.line, padding: 12, gap: 8 },
  barText: { fontSize: 13, color: COLORS.muted, textAlign: 'center' },
})
