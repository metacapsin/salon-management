import { StyleSheet, Text, View } from 'react-native'
import { useAuth } from '../auth/AuthContext'
import Button from '../components/Button'
import { EmptyState } from '../components/States'
import { COLORS, RADIUS } from '../config/theme'

// A signed-in user who belongs to no salon (and is not a Super Admin).
export default function NoSalonScreen() {
  const { logout } = useAuth()
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <EmptyState icon="storefront-outline" title="No salon yet" text="Your account is not linked to a salon. Ask your salon owner to invite you, or create your salon on the Galora website." />
        <Button title="Sign out" icon="log-out-outline" variant="secondary" onPress={logout} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.espresso, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: COLORS.cream, borderRadius: RADIUS.xl, padding: 20, width: '100%', maxWidth: 440, alignSelf: 'center' },
})
