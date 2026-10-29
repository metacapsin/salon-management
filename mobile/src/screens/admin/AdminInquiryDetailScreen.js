import { useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addInquiryNote, fetchInquiry, INQUIRY_STATUSES, setInquiryStatus } from '../../api/platformApi'
import { friendlyError } from '../../api/client'
import Button from '../../components/Button'
import { StatusBadge } from '../../components/Chips'
import { ChoiceChips } from '../../components/Form'
import { Card, ErrorNote, Screen, SectionTitle } from '../../components/Screen'
import { LoadingState } from '../../components/States'
import TextField from '../../components/TextField'
import { COLORS } from '../../config/theme'
import { statusLabel } from './AdminInquiriesScreen'

const formatWhen = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const LABELS = INQUIRY_STATUSES.map((s) => s.label)

function LinkButton({ label, url }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => Linking.openURL(url)} style={styles.linkButton}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  )
}

// One inquiry: who wrote, the message, its status and the team's private notes.
export default function AdminInquiryDetailScreen({ route }) {
  const { id } = route.params
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['platform-inquiry', id], queryFn: () => fetchInquiry(id) })
  const [note, setNote] = useState('')
  const inquiry = query.data

  // After a change, keep the fresh copy here and refresh the list (its status badge and counts).
  const saved = (fresh) => {
    queryClient.setQueryData(['platform-inquiry', id], fresh)
    queryClient.invalidateQueries({ queryKey: ['platform-inquiries'] })
  }
  const statusMutation = useMutation({ mutationFn: (status) => setInquiryStatus(id, status), onSuccess: saved })
  const noteMutation = useMutation({
    mutationFn: (text) => addInquiryNote(id, text),
    onSuccess: (fresh) => {
      saved(fresh)
      setNote('')
    },
  })

  const error = statusMutation.error ?? noteMutation.error
  const phoneDigits = inquiry?.phone?.replace(/[^\d+]/g, '')

  return (
    <Screen onRefresh={query.refetch} refreshing={query.isRefetching}>
      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? <ErrorNote message={friendlyError(query.error)} onRetry={query.refetch} /> : null}

      {inquiry ? (
        <>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{inquiry.name}</Text>
            <StatusBadge status={statusLabel(inquiry.status).toLowerCase()} />
          </View>
          <Text style={styles.muted}>Received {formatWhen(inquiry.createdAt)}</Text>

          <Card style={styles.gapTop}>
            <Text style={styles.value}>{inquiry.email}</Text>
            <Text style={styles.value}>{inquiry.phone}</Text>
            <View style={styles.links}>
              <LinkButton label="Email customer" url={`mailto:${inquiry.email}?subject=${encodeURIComponent('Your message to Galora')}`} />
              <LinkButton label="Call customer" url={`tel:${phoneDigits}`} />
            </View>
          </Card>

          <Card>
            <Text style={styles.message} selectable>
              {inquiry.message}
            </Text>
          </Card>

          <Card>
            <ChoiceChips
              label="Status"
              options={LABELS}
              value={statusLabel(inquiry.status)}
              onChange={(label) => {
                const next = INQUIRY_STATUSES.find((s) => s.label === label)
                if (next && next.value !== inquiry.status && !statusMutation.isPending) statusMutation.mutate(next.value)
              }}
            />
          </Card>

          <SectionTitle>Admin notes (private)</SectionTitle>
          <Card>
            {inquiry.notes.length === 0 ? <Text style={styles.muted}>No notes yet.</Text> : null}
            {inquiry.notes.map((n) => (
              <View key={n.id} style={styles.note}>
                <Text style={styles.noteText}>{n.text}</Text>
                <Text style={styles.muted}>
                  {n.authorName || 'Admin'} · {formatWhen(n.createdAt)}
                </Text>
              </View>
            ))}
          </Card>

          <Card>
            <TextField label="Add a note" value={note} onChangeText={setNote} multiline maxLength={1000} style={styles.noteInput} />
            <Button title="Add note" onPress={() => note.trim() && noteMutation.mutate(note.trim())} loading={noteMutation.isPending} disabled={!note.trim()} />
          </Card>

          {error ? <Text style={styles.error}>{friendlyError(error)}</Text> : null}
        </>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: COLORS.ink, fontFamily: 'serif' },
  muted: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  gapTop: { marginTop: 12 },
  value: { fontSize: 15, color: COLORS.ink, marginBottom: 2 },
  links: { flexDirection: 'row', gap: 10, marginTop: 10 },
  linkButton: { flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: COLORS.brown, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  linkText: { color: COLORS.brown, fontSize: 14, fontWeight: '600' },
  message: { fontSize: 15, color: COLORS.ink, lineHeight: 22 },
  note: { paddingVertical: 6 },
  noteText: { fontSize: 14, color: COLORS.ink },
  noteInput: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  error: { color: COLORS.error, fontSize: 13, marginTop: 4 },
})
