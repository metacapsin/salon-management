import { StyleSheet, Text, View } from 'react-native'
import { useAuth } from '../auth/AuthContext'
import Button from '../components/Button'
import { COLORS } from '../config/theme'

// A signed-in user who belongs to no salon (and is not a Super Admin).
export default function NoSalonScreen() {
  const { logout } = useAuth()
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>No salon yet</Text>
        <Text style={styles.text}>Your account is not linked to a salon. Ask your salon owner to invite you, or create your salon on the Glamora website.</Text>
        <Button title="Sign out" onPress={logout} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.espresso, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: COLORS.cream, borderRadius: 16, padding: 20, width: '100%', maxWidth: 440, alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.ink, fontFamily: 'serif', marginBottom: 8 },
  text: { fontSize: 14, color: COLORS.muted, marginBottom: 20 },
})
