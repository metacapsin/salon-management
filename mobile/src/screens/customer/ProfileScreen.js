import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../auth/AuthContext'
import Button from '../../components/Button'
import { Card, Screen } from '../../components/Screen'
import { COLORS, FONT, RADIUS } from '../../config/theme'

// The customer's account page: who is signed in, shortcuts, sign out. Only data the server returned (name, mobile).
export default function ProfileScreen({ navigation }) {
  const { customer, logout } = useAuth()
  return (
    <Screen>
      <View style={styles.top}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{customer?.name?.[0]?.toUpperCase() ?? 'G'}</Text>
        </View>
        <Text style={styles.name}>{customer?.name}</Text>
        {customer?.phone ? <Text style={styles.muted}>+91 {customer.phone}</Text> : null}
      </View>

      <Card style={styles.menu}>
        <Pressable onPress={() => navigation.navigate('Bookings')} accessibilityRole="button" accessibilityLabel="My appointments" style={styles.row}>
          <Ionicons name="calendar-outline" size={22} color={COLORS.brown} />
          <Text style={styles.rowText}>My appointments</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Home')} accessibilityRole="button" accessibilityLabel="Find a salon" style={[styles.row, styles.rowLast]}>
          <Ionicons name="search-outline" size={22} color={COLORS.brown} />
          <Text style={styles.rowText}>Find a salon</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
        </Pressable>
      </Card>

      <Button title="Sign out" icon="log-out-outline" variant="secondary" onPress={logout} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', paddingVertical: 24, gap: 4 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.espresso, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarText: { color: COLORS.gold, fontSize: 34, fontWeight: '700', fontFamily: FONT.heading },
  name: { fontSize: 22, fontWeight: '700', color: COLORS.ink, fontFamily: FONT.heading },
  muted: { fontSize: 14, color: COLORS.muted },
  menu: { padding: 0, overflow: 'hidden', borderRadius: RADIUS.lg, marginVertical: 12 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1, fontSize: 16, color: COLORS.ink },
})
