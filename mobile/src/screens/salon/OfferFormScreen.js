import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createOffer, fetchServices, updateOffer } from '../../api/salonApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import Button from '../../components/Button'
import { ChoiceChips, MultiChips, SwitchRow } from '../../components/Form'
import { Card, Screen } from '../../components/Screen'
import TextField from '../../components/TextField'
import { COLORS } from '../../config/theme'
import { todayString } from '../../utils/dates'

const TYPES = { 'Percent (%)': 'percent', 'Flat (₹)': 'flat' }
const DATE_OK = /^\d{4}-\d{2}-\d{2}$/

// Same date, N days later, as YYYY-MM-DD (noon avoids daylight-saving edge cases).
function plusDays(day, n) {
  const d = new Date(`${day}T12:00:00`)
  d.setDate(d.getDate() + n)
  const pad = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Add an offer (no params) or edit one (params.offer). Only Owner/Manager can reach this screen;
// the server checks the role and every rule again on save.
export default function OfferFormScreen({ navigation, route }) {
  const existing = route.params?.offer
  const { activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const today = todayString()

  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [typeLabel, setTypeLabel] = useState(existing ? (existing.discountType === 'percent' ? 'Percent (%)' : 'Flat (₹)') : 'Percent (%)')
  const [value, setValue] = useState(existing ? String(existing.discountValue) : '')
  const [startsOn, setStartsOn] = useState(existing?.startsOn ?? today)
  const [endsOn, setEndsOn] = useState(existing?.endsOn ?? plusDays(today, 30))
  const [serviceIds, setServiceIds] = useState(existing?.serviceIds?.map(String) ?? [])
  const [oncePerCustomer, setOncePerCustomer] = useState(existing?.oncePerCustomer ?? false)
  const [active, setActive] = useState(existing?.active ?? true)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')

  const services = useQuery({ queryKey: ['services', activeSalonId, false], queryFn: () => fetchServices({ includeInactive: false }), staleTime: 0 })

  const save = useMutation({
    mutationFn: (body) => (existing ? updateOffer(existing.id, { ...body, active }) : createOffer(body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers', activeSalonId] })
      navigation.goBack()
    },
    onError: (error) => {
      setErrors(error?.fieldErrors ?? {})
      setFormError(error?.fieldErrors && Object.keys(error.fieldErrors).length ? 'Please check the highlighted fields.' : friendlyError(error))
    },
  })

  function submit() {
    setFormError('')
    const found = {}
    const discountValue = Number(value)
    const discountType = TYPES[typeLabel]
    if (title.trim().length < 2) found.title = 'Title must be at least 2 characters.'
    if (value.trim() === '' || !Number.isInteger(discountValue) || discountValue < 1) found.discountValue = 'Enter a whole number, at least 1.'
    else if (discountType === 'percent' && discountValue > 100) found.discountValue = 'Percentage cannot be more than 100.'
    if (!DATE_OK.test(startsOn)) found.startsOn = 'Use a date like 2026-11-01.'
    if (!DATE_OK.test(endsOn)) found.endsOn = 'Use a date like 2026-11-30.'
    else if (DATE_OK.test(startsOn) && endsOn < startsOn) found.endsOn = 'End date cannot be before the start date.'
    setErrors(found)
    if (Object.keys(found).length) return
    save.mutate({ title: title.trim(), description: description.trim(), discountType, discountValue, serviceIds, startsOn, endsOn, oncePerCustomer })
  }

  return (
    <Screen>
      <Card>
        {formError ? <Text style={styles.banner}>{formError}</Text> : null}
        <TextField label="Title" value={title} onChangeText={setTitle} error={errors.title} placeholder="e.g. Festive 10" maxLength={80} />
        <TextField label="Description (optional)" value={description} onChangeText={setDescription} error={errors.description} multiline maxLength={300} style={styles.multiline} />
        <ChoiceChips label="Discount type" options={Object.keys(TYPES)} value={typeLabel} onChange={setTypeLabel} error={errors.discountType} />
        <TextField label={TYPES[typeLabel] === 'percent' ? 'Discount (%)' : 'Discount (₹)'} value={value} onChangeText={setValue} error={errors.discountValue} keyboardType="number-pad" placeholder="10" />
        <TextField label="Starts on (YYYY-MM-DD)" value={startsOn} onChangeText={setStartsOn} error={errors.startsOn} autoCapitalize="none" maxLength={10} />
        <TextField label="Ends on (YYYY-MM-DD)" value={endsOn} onChangeText={setEndsOn} error={errors.endsOn} autoCapitalize="none" maxLength={10} />

        {services.data?.length ? (
          <MultiChips label="Works on these services" options={services.data.map((s) => ({ value: s.id, label: s.name }))} selected={serviceIds} onChange={setServiceIds} error={errors.serviceIds} />
        ) : null}
        {services.data?.length ? <Text style={styles.hint}>Choose none to apply it to every service.</Text> : null}

        <SwitchRow label="Once per customer" value={oncePerCustomer} onValueChange={setOncePerCustomer} hint="A customer can use this offer only one time." />
        {existing ? <SwitchRow label="Active" value={active} onValueChange={setActive} hint="Switch off to stop the offer without deleting it." /> : null}
        <View style={styles.gap} />
        <Button title={existing ? 'Save changes' : 'Add offer'} onPress={submit} loading={save.isPending} />
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  banner: { color: COLORS.error, backgroundColor: '#fdecea', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 14 },
  multiline: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  hint: { fontSize: 12, color: COLORS.muted, marginTop: -8, marginBottom: 12 },
  gap: { height: 12 },
})
