import { StyleSheet, Text } from 'react-native'
import { Card, Screen } from '../components/Screen'
import { COLORS } from '../config/theme'

// Placeholder for sections whose real screens are built in Step 7.
export default function ComingSoonScreen({ route }) {
  return (
    <Screen>
      <Card>
        <Text style={styles.title}>{route.name}</Text>
        <Text style={styles.text}>This section is connected to the server in the next step.</Text>
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700', color: COLORS.ink, fontFamily: 'serif', marginBottom: 6 },
  text: { fontSize: 14, color: COLORS.muted },
})
