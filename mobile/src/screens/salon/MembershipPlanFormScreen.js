import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createPlan, updatePlan } from '../../api/membershipsApi'
import { fetchServices } from '../../api/salonApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import Button from '../../components/Button'
import { ChoiceChips, MultiChips, SwitchRow } from '../../components/Form'
import { Card, Screen } from '../../components/Screen'
import TextField from '../../components/TextField'
import { COLORS } from '../../config/theme'

const TYPES = { 'Percent (%)': 'percent', 'Flat (₹)': 'flat' }

// Add a membership plan (no params) or edit one (params.plan). Only the Owner can reach this screen
// (memberships.write); the server checks the role and every rule again on save.
export default function MembershipPlanFormScreen({ navigation, route }) {
  const existing = route.params?.plan
  const { activeSalonId } = useAuth()
  const queryClient = useQueryClient()

  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [price, setPrice] = useState(existing ? String(existing.price) : '')
  const [days, setDays] = useState(existing ? String(existing.durationDays) : '365')
  const [typeLabel, setTypeLabel] = useState(existing ? (existing.discountType === 'percent' ? 'Percent (%)' : 'Flat (₹)') : 'Percent (%)')
  const [value, setValue] = useState(existing ? String(existing.discountValue) : '')
  const [serviceIds, setServiceIds] = useState(existing?.serviceIds?.map(String) ?? [])
  const [benefits, setBenefits] = useState(existing?.benefits?.join('\n') ?? '')
  const [active, setActive] = useState(existing?.active ?? true)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')

  const services = useQuery({ queryKey: ['services', activeSalonId, false], queryFn: () => fetchServices({ includeInactive: false }), staleTime: 0 })
  const clear = (...keys) => setErrors((e) => ({ ...e, ...Object.fromEntries(keys.map((k) => [k, undefined])) }))

  const save = useMutation({
    mutationFn: (body) => (existing ? updatePlan(existing.id, body) : createPlan(body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-plans', activeSalonId] })
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
    const priceNumber = Number(price)
    const durationDays = Number(days)
    const discountValue = Number(value)
    const discountType = TYPES[typeLabel]
    const lines = benefits.split('\n').map((b) => b.trim()).filter(Boolean)
    if (name.trim().length < 2) found.name = 'Name must be at least 2 characters.'
    if (price.trim() === '' || !Number.isInteger(priceNumber) || priceNumber < 0) found.price = 'Enter the price in whole rupees.'
    if (days.trim() === '' || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 1095) found.durationDays = 'Enter 1 to 1095 days.'
    if (value.trim() === '' || !Number.isInteger(discountValue) || discountValue < 1) found.discountValue = 'Enter a whole number, at least 1.'
    else if (discountType === 'percent' && discountValue > 100) found.discountValue = 'Percentage cannot be more than 100.'
    if (lines.length > 10) found.benefits = 'At most 10 benefits.'
    setErrors(found)
    if (Object.keys(found).length) return
    save.mutate({
      name: name.trim(),
      description: description.trim(),
      price: priceNumber,
      durationDays,
      discountType,
      discountValue,
      serviceIds,
      benefits: lines,
      ...(existing ? { active } : {}),
    })
  }

  return (
    <Screen>
      <Card>
        {formError ? <Text style={styles.banner}>{formError}</Text> : null}
        <TextField label="Plan name" value={name} onChangeText={(v) => { setName(v); clear('name') }} error={errors.name} placeholder="e.g. Gold" maxLength={80} />
        <TextField label="Description (optional)" value={description} onChangeText={setDescription} error={errors.description} multiline maxLength={300} style={styles.multiline} />
        <TextField label="Price (₹)" value={price} onChangeText={(v) => { setPrice(v); clear('price') }} error={errors.price} keyboardType="number-pad" placeholder="2000" />
        <TextField label="Valid for (days)" value={days} onChangeText={(v) => { setDays(v); clear('durationDays') }} error={errors.durationDays} keyboardType="number-pad" placeholder="365" />
        <ChoiceChips label="Discount type" options={Object.keys(TYPES)} value={typeLabel} onChange={(v) => { setTypeLabel(v); clear('discountValue') }} error={errors.discountType} />
        <TextField label={TYPES[typeLabel] === 'percent' ? 'Discount (%)' : 'Discount (₹)'} value={value} onChangeText={(v) => { setValue(v); clear('discountValue') }} error={errors.discountValue} keyboardType="number-pad" placeholder="20" />
        {services.data?.length ? <MultiChips label="Discount works on these services" options={services.data.map((s) => ({ value: s.id, label: s.name }))} selected={serviceIds} onChange={setServiceIds} error={errors.serviceIds} /> : null}
        {services.data?.length ? <Text style={styles.hint}>Choose none to apply it to every service.</Text> : null}
        <TextField label="Benefits (one per line, optional)" value={benefits} onChangeText={(v) => { setBenefits(v); clear('benefits') }} error={errors.benefits} multiline style={styles.multiline} placeholder={'Free hair wash\nPriority booking'} />
        {existing ? <SwitchRow label="Active" value={active} onValueChange={setActive} hint="Switched-off plans cannot be sold. Members who already have it keep their discount." /> : null}
        {existing ? <Text style={styles.hint}>Changes affect only future sales. Members keep the terms they bought.</Text> : null}
        <View style={styles.gap} />
        <Button title={existing ? 'Save changes' : 'Add plan'} onPress={submit} loading={save.isPending} />
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
