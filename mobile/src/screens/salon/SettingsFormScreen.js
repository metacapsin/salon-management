import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateSalonSettings } from '../../api/salonApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import Button from '../../components/Button'
import { ChoiceChips, MultiChips } from '../../components/Form'
import { Card, Screen } from '../../components/Screen'
import TextField from '../../components/TextField'
import { COLORS } from '../../config/theme'

// Same list as the server (backend salons.routes.js FACILITIES).
export const FACILITY_LABELS = {
  ac: 'AC',
  parking: 'Parking',
  wifi: 'Wi-Fi',
  wheelchair: 'Wheelchair access',
  'card-payment': 'Card payment',
  'waiting-area': 'Waiting area',
  'tea-coffee': 'Tea / coffee',
  'bridal-room': 'Bridal room',
}
const AUDIENCES = { Women: 'women', Men: 'men', Unisex: 'unisex' }
const PHONE_OK = /^\+?[0-9 -]{7,20}$/

// Edit the salon's details. Only the Owner can reach this screen, and the server checks the role on save.
// The booking address (slug) and timezone are not changed here on purpose: changing the slug breaks shared links.
export default function SettingsFormScreen({ navigation, route }) {
  const salon = route.params.salon
  const { activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const a = salon.address ?? {}

  const [name, setName] = useState(salon.name ?? '')
  const [ownerName, setOwnerName] = useState(salon.ownerContact?.name ?? '')
  const [phone, setPhone] = useState(salon.ownerContact?.phone ?? '')
  const [about, setAbout] = useState(salon.about ?? '')
  const [audience, setAudience] = useState(Object.keys(AUDIENCES).find((k) => AUDIENCES[k] === salon.audience) ?? 'Unisex')
  const [facilities, setFacilities] = useState(salon.facilities ?? [])
  const [line1, setLine1] = useState(a.line1 ?? '')
  const [area, setArea] = useState(a.area ?? '')
  const [city, setCity] = useState(a.city ?? '')
  const [state, setState] = useState(a.state ?? '')
  const [pincode, setPincode] = useState(a.pincode ?? '')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')

  const save = useMutation({
    mutationFn: updateSalonSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', activeSalonId] })
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
    if (name.trim().length < 2) found.name = 'Salon name must be at least 2 characters.'
    if (ownerName.trim().length < 1) found.ownerName = 'Enter a name.'
    if (phone.trim() && !PHONE_OK.test(phone.trim())) found.phone = 'Enter a valid phone number.'
    setErrors(found)
    if (Object.keys(found).length) return
    save.mutate({
      name: name.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      about: about.trim(),
      audience: AUDIENCES[audience],
      facilities,
      address: { line1: line1.trim(), area: area.trim(), city: city.trim(), state: state.trim(), pincode: pincode.trim() },
    })
  }

  return (
    <Screen>
      <Card>
        {formError ? <Text style={styles.banner}>{formError}</Text> : null}
        <TextField label="Salon name" value={name} onChangeText={setName} error={errors.name} maxLength={100} />
        <TextField label="Owner name" value={ownerName} onChangeText={setOwnerName} error={errors.ownerName} maxLength={100} />
        <TextField label="Phone" value={phone} onChangeText={setPhone} error={errors.phone} keyboardType="phone-pad" maxLength={20} />
        <TextField label="About" value={about} onChangeText={setAbout} error={errors.about} multiline maxLength={500} style={styles.multiline} />
        <ChoiceChips label="Who is it for" options={Object.keys(AUDIENCES)} value={audience} onChange={setAudience} error={errors.audience} />
        <MultiChips
          label="Facilities"
          options={Object.entries(FACILITY_LABELS).map(([value, label]) => ({ value, label }))}
          selected={facilities}
          onChange={setFacilities}
          error={errors.facilities}
        />
        <TextField label="Address line" value={line1} onChangeText={setLine1} error={errors['address.line1']} maxLength={200} />
        <TextField label="Area" value={area} onChangeText={setArea} error={errors['address.area']} maxLength={100} />
        <TextField label="City" value={city} onChangeText={setCity} error={errors['address.city']} maxLength={100} />
        <TextField label="State" value={state} onChangeText={setState} error={errors['address.state']} maxLength={100} />
        <TextField label="Pincode" value={pincode} onChangeText={setPincode} error={errors['address.pincode']} keyboardType="number-pad" maxLength={10} />
        <View style={styles.gap} />
        <Button title="Save changes" onPress={submit} loading={save.isPending} />
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  banner: { color: COLORS.error, backgroundColor: '#fdecea', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 14 },
  multiline: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },
  gap: { height: 12 },
})
