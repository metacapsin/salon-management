import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createService, deactivateService, updateService } from '../../api/salonApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import Button from '../../components/Button'
import { ChoiceChips, SwitchRow } from '../../components/Form'
import { Card, Screen } from '../../components/Screen'
import TextField from '../../components/TextField'
import { SERVICE_CATEGORIES } from '../../config/serviceCategories'
import { COLORS } from '../../config/theme'

// Add a service (no params) or edit one (params.service). Only Owner/Manager can reach this screen,
// and the server checks the role again on save.
export default function ServiceFormScreen({ navigation, route }) {
  const existing = route.params?.service
  const { activeSalonId } = useAuth()
  const queryClient = useQueryClient()

  const [name, setName] = useState(existing?.name ?? '')
  const [category, setCategory] = useState(existing?.category ?? 'Other')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [price, setPrice] = useState(existing ? String(existing.price) : '')
  const [duration, setDuration] = useState(existing ? String(existing.durationMin) : '30')
  const [atSalon, setAtSalon] = useState(existing?.atSalon ?? true)
  const [atHome, setAtHome] = useState(existing?.atHome ?? false)
  const [active, setActive] = useState(existing?.active ?? true)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [confirmStop, setConfirmStop] = useState(false)

  const done = () => {
    queryClient.invalidateQueries({ queryKey: ['services', activeSalonId] })
    navigation.goBack()
  }
  const onFail = (error) => {
    setErrors(error?.fieldErrors ?? {})
    setFormError(error?.fieldErrors && Object.keys(error.fieldErrors).length ? 'Please check the highlighted fields.' : friendlyError(error))
  }

  const save = useMutation({
    mutationFn: (body) => (existing ? updateService(existing.id, { ...body, active }) : createService(body)),
    onSuccess: done,
    onError: onFail,
  })
  const stop = useMutation({ mutationFn: () => deactivateService(existing.id), onSuccess: done, onError: onFail })

  function submit() {
    setFormError('')
    const found = {}
    const priceNumber = Number(price)
    const durationNumber = Number(duration)
    if (name.trim().length < 2) found.name = 'Service name must be at least 2 characters.'
    if (price.trim() === '' || !Number.isInteger(priceNumber) || priceNumber < 0) found.price = 'Enter the price in whole rupees.'
    if (duration.trim() === '' || !Number.isInteger(durationNumber)) found.durationMin = 'Enter the duration in minutes.'
    if (!atSalon && !atHome) found.atSalon = 'Choose at least one place: at the salon or at home.'
    setErrors(found)
    if (Object.keys(found).length) return
    save.mutate({ name: name.trim(), category, description: description.trim(), price: priceNumber, durationMin: durationNumber, atSalon, atHome })
  }

  return (
    <Screen>
      <Card>
        {formError ? <Text style={styles.banner}>{formError}</Text> : null}
        <TextField label="Service name" value={name} onChangeText={setName} error={errors.name} placeholder="e.g. Haircut" maxLength={100} />
        <ChoiceChips label="Category" options={SERVICE_CATEGORIES} value={category} onChange={setCategory} error={errors.category} />
        <TextField label="Description (optional)" value={description} onChangeText={setDescription} error={errors.description} multiline maxLength={500} style={styles.multiline} />
        <TextField label="Price (₹)" value={price} onChangeText={setPrice} error={errors.price} keyboardType="number-pad" placeholder="300" />
        <TextField label="Duration (minutes, in steps of 5)" value={duration} onChangeText={setDuration} error={errors.durationMin} keyboardType="number-pad" placeholder="30" />
        <SwitchRow label="Available at the salon" value={atSalon} onValueChange={setAtSalon} />
        <SwitchRow label="Available at home" value={atHome} onValueChange={setAtHome} />
        {errors.atSalon ? <Text style={styles.error}>{errors.atSalon}</Text> : null}
        {existing ? <SwitchRow label="Active" value={active} onValueChange={setActive} hint="Stopped services cannot be booked, but old bills keep them." /> : null}
        <View style={styles.gap} />
        <Button title={existing ? 'Save changes' : 'Add service'} onPress={submit} loading={save.isPending} disabled={stop.isPending} />
      </Card>

      {existing && existing.active ? (
        <Card>
          {!confirmStop ? (
            <Button title="Stop this service" onPress={() => setConfirmStop(true)} disabled={save.isPending} />
          ) : (
            <>
              <Text style={styles.confirm}>Stop "{existing.name}"? Customers will no longer be able to book it. You can turn it on again later.</Text>
              <Button title="Yes, stop it" onPress={() => stop.mutate()} loading={stop.isPending} />
              <View style={styles.gap} />
              <Button title="Keep it" onPress={() => setConfirmStop(false)} />
            </>
          )}
        </Card>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  banner: { color: COLORS.error, backgroundColor: '#fdecea', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 14 },
  multiline: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  error: { color: COLORS.error, fontSize: 13, marginBottom: 6 },
  gap: { height: 12 },
  confirm: { fontSize: 14, color: COLORS.ink, marginBottom: 12 },
})
