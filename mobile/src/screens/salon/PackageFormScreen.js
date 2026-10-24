import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createPackage, updatePackage } from '../../api/packagesApi'
import { fetchServices } from '../../api/salonApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import Button from '../../components/Button'
import { SwitchRow } from '../../components/Form'
import { Card, Screen, SectionTitle } from '../../components/Screen'
import TextField from '../../components/TextField'
import { COLORS } from '../../config/theme'
import { formatMoney } from '../../utils/formatMoney'

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/

// Add a package (no params) or edit one (params.pkg). Only Owner/Manager can reach this screen.
// The server fixes each service's price itself; we only send which services and how many sessions.
export default function PackageFormScreen({ navigation, route }) {
  const existing = route.params?.pkg
  const { activeSalonId } = useAuth()
  const queryClient = useQueryClient()

  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [items, setItems] = useState(existing?.items?.map((i) => ({ serviceId: String(i.serviceId), serviceName: i.serviceName, sessions: i.sessions })) ?? [])
  const [price, setPrice] = useState(existing ? String(existing.packagePrice) : '')
  const [validity, setValidity] = useState(existing ? String(existing.validityDays) : '90')
  const [saleStartsOn, setSaleStartsOn] = useState(existing?.saleStartsOn ?? '')
  const [saleEndsOn, setSaleEndsOn] = useState(existing?.saleEndsOn ?? '')
  const [active, setActive] = useState(existing?.active ?? true)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')

  const services = useQuery({ queryKey: ['services', activeSalonId, false], queryFn: () => fetchServices({ includeInactive: false }), staleTime: 0 })
  const priceOf = useMemo(() => new Map((services.data ?? []).map((s) => [s.id, s.price])), [services.data])
  const itemsChanged = JSON.stringify(items.map((i) => [i.serviceId, i.sessions])) !== JSON.stringify((existing?.items ?? []).map((i) => [String(i.serviceId), i.sessions]))

  // Only a hint: the server works out the real total again.
  const hintTotal = items.reduce((sum, i) => sum + (priceOf.get(i.serviceId) ?? 0) * i.sessions, 0)

  const save = useMutation({
    mutationFn: (body) => (existing ? updatePackage(existing.id, body) : createPackage(body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages', activeSalonId] })
      navigation.goBack()
    },
    onError: (error) => {
      setErrors(error?.fieldErrors ?? {})
      setFormError(error?.fieldErrors && Object.keys(error.fieldErrors).length ? 'Please check the highlighted fields.' : friendlyError(error))
    },
  })

  const addService = (s) => setItems((list) => (list.some((i) => i.serviceId === s.id) ? list : [...list, { serviceId: s.id, serviceName: s.name, sessions: 1 }]))
  const setSessions = (id, sessions) => setItems((list) => list.map((i) => (i.serviceId === id ? { ...i, sessions } : i)))
  const removeItem = (id) => setItems((list) => list.filter((i) => i.serviceId !== id))

  function submit() {
    setFormError('')
    const found = {}
    const packagePrice = Number(price)
    const validityDays = Number(validity)
    if (name.trim().length < 2) found.name = 'Name must be at least 2 characters.'
    if (items.length === 0) found.items = 'Add at least one service.'
    if (price.trim() === '' || !Number.isInteger(packagePrice) || packagePrice < 0) found.packagePrice = 'Enter the price in whole rupees.'
    if (validity.trim() === '' || !Number.isInteger(validityDays) || validityDays < 1 || validityDays > 1095) found.validityDays = 'Enter validity from 1 to 1095 days.'
    if (saleStartsOn && !DATE_OK.test(saleStartsOn)) found.saleStartsOn = 'Use a date like 2026-11-01, or leave empty.'
    if (saleEndsOn && !DATE_OK.test(saleEndsOn)) found.saleEndsOn = 'Use a date like 2026-11-30, or leave empty.'
    if (saleStartsOn && saleEndsOn && DATE_OK.test(saleStartsOn) && DATE_OK.test(saleEndsOn) && saleEndsOn < saleStartsOn) found.saleEndsOn = 'End date cannot be before the start date.'
    setErrors(found)
    if (Object.keys(found).length) return
    const body = {
      name: name.trim(),
      description: description.trim(),
      packagePrice,
      validityDays,
      saleStartsOn: saleStartsOn || null,
      saleEndsOn: saleEndsOn || null,
    }
    // When editing, send the services only if they changed (a service switched off later would otherwise be refused).
    if (!existing || itemsChanged) body.items = items.map((i) => ({ serviceId: i.serviceId, sessions: i.sessions }))
    if (existing) body.active = active
    save.mutate(body)
  }

  const available = (services.data ?? []).filter((s) => !items.some((i) => i.serviceId === s.id))

  return (
    <Screen>
      <Card>
        {formError ? <Text style={styles.banner}>{formError}</Text> : null}
        <TextField label="Package name" value={name} onChangeText={setName} error={errors.name} placeholder="e.g. Haircut Saver" maxLength={100} />
        <TextField label="Description (optional)" value={description} onChangeText={setDescription} error={errors.description} multiline maxLength={500} style={styles.multiline} />

        <Text style={styles.label}>Services in the package</Text>
        {items.map((i) => (
          <View key={i.serviceId} style={styles.itemRow}>
            <Text style={styles.itemName}>{i.serviceName}</Text>
            <View style={styles.stepper}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Fewer sessions of ${i.serviceName}`} onPress={() => setSessions(i.serviceId, Math.max(1, i.sessions - 1))} style={styles.stepBtn}>
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Text style={styles.stepValue}>{i.sessions}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`More sessions of ${i.serviceName}`} onPress={() => setSessions(i.serviceId, Math.min(100, i.sessions + 1))} style={styles.stepBtn}>
                <Text style={styles.stepText}>+</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${i.serviceName}`} onPress={() => removeItem(i.serviceId)} style={styles.stepBtn}>
                <Text style={[styles.stepText, { color: COLORS.error }]}>×</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {errors.items ? <Text style={styles.error}>{errors.items}</Text> : null}
        <View style={styles.chips}>
          {available.map((s) => (
            <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`Add ${s.name}`} onPress={() => addService(s)} style={styles.chip}>
              <Text style={styles.chipText}>+ {s.name}</Text>
            </Pressable>
          ))}
        </View>
        {services.isError ? <Text style={styles.error}>{friendlyError(services.error)}</Text> : null}
        {hintTotal > 0 ? <Text style={styles.hint}>Services total {formatMoney(hintTotal)}. The package price cannot be more than this.</Text> : null}

        <TextField label="Package price (₹)" value={price} onChangeText={setPrice} error={errors.packagePrice} keyboardType="number-pad" placeholder="1200" />
        <TextField label="Valid for (days after purchase)" value={validity} onChangeText={setValidity} error={errors.validityDays} keyboardType="number-pad" placeholder="90" />
        <TextField label="On sale from (optional, YYYY-MM-DD)" value={saleStartsOn} onChangeText={setSaleStartsOn} error={errors.saleStartsOn} autoCapitalize="none" maxLength={10} />
        <TextField label="On sale until (optional, YYYY-MM-DD)" value={saleEndsOn} onChangeText={setSaleEndsOn} error={errors.saleEndsOn} autoCapitalize="none" maxLength={10} />
        {existing ? <SwitchRow label="Active" value={active} onValueChange={setActive} hint="Switched-off packages cannot be sold. Packages already sold keep working." /> : null}
        {existing ? <Text style={styles.hint}>Changes affect only future sales. Packages already sold keep their own copy.</Text> : null}
        <View style={styles.gap} />
        <Button title={existing ? 'Save changes' : 'Add package'} onPress={submit} loading={save.isPending} />
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  banner: { color: COLORS.error, backgroundColor: '#fdecea', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 14 },
  multiline: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.ink, marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 6 },
  itemName: { flex: 1, fontSize: 15, color: COLORS.ink },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: { minWidth: 40, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  stepText: { fontSize: 20, color: COLORS.brown, fontWeight: '700' },
  stepValue: { minWidth: 28, textAlign: 'center', fontSize: 16, color: COLORS.ink, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff', justifyContent: 'center' },
  chipText: { fontSize: 14, color: COLORS.ink },
  error: { color: COLORS.error, fontSize: 13, marginBottom: 6 },
  hint: { fontSize: 12, color: COLORS.muted, marginBottom: 12 },
  gap: { height: 12 },
})
