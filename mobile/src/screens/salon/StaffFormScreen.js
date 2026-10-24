import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createStaff, fetchServices, updateStaff } from '../../api/salonApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import Button from '../../components/Button'
import { MultiChips, SwitchRow } from '../../components/Form'
import { Card, Screen } from '../../components/Screen'
import TextField from '../../components/TextField'
import { COLORS } from '../../config/theme'
import { hoursSummary } from './StaffScreen'

// Add a staff member (no params) or edit one (params.staff). Only Owner/Manager can reach this screen.
// Working hours are shown but not edited here yet: a new member follows the salon hours until hours are set on the website.
export default function StaffFormScreen({ navigation, route }) {
  const existing = route.params?.staff
  const { activeSalonId } = useAuth()
  const queryClient = useQueryClient()

  const [name, setName] = useState(existing?.name ?? '')
  const [title, setTitle] = useState(existing?.title ?? '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [skills, setSkills] = useState(existing?.skills?.join(', ') ?? '')
  const [serviceIds, setServiceIds] = useState(existing?.serviceIds?.map(String) ?? [])
  const [active, setActive] = useState(existing?.active ?? true)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')

  // Only this salon's active services can be chosen (the server also refuses ids of other salons).
  // staleTime 0: a form must offer the newest list, not a copy that is up to 30 seconds old.
  const services = useQuery({ queryKey: ['services', activeSalonId, false], queryFn: () => fetchServices({ includeInactive: false }), staleTime: 0 })

  const save = useMutation({
    mutationFn: (body) => (existing ? updateStaff(existing.id, { ...body, active }) : createStaff(body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', activeSalonId] })
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
    if (name.trim().length < 2) found.name = 'Name must be at least 2 characters.'
    setErrors(found)
    if (Object.keys(found).length) return
    save.mutate({
      name: name.trim(),
      title: title.trim(),
      phone: phone.trim(),
      skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
      serviceIds,
    })
  }

  return (
    <Screen>
      <Card>
        {formError ? <Text style={styles.banner}>{formError}</Text> : null}
        <TextField label="Name" value={name} onChangeText={setName} error={errors.name} placeholder="e.g. Meera Joshi" maxLength={100} />
        <TextField label="Title (optional)" value={title} onChangeText={setTitle} error={errors.title} placeholder="e.g. Senior stylist" maxLength={60} />
        <TextField label="Phone (optional)" value={phone} onChangeText={setPhone} error={errors.phone} keyboardType="phone-pad" maxLength={20} />
        <TextField label="Skills (optional, separate with commas)" value={skills} onChangeText={setSkills} error={errors.skills} placeholder="Haircut, Colour" />

        {services.isLoading ? <Text style={styles.muted}>Loading services…</Text> : null}
        {services.isError ? <Text style={styles.error}>{friendlyError(services.error)}</Text> : null}
        {services.data?.length ? (
          <MultiChips
            label="Services this person does"
            options={services.data.map((s) => ({ value: s.id, label: s.name }))}
            selected={serviceIds}
            onChange={setServiceIds}
            error={errors.serviceIds}
          />
        ) : null}
        {services.data?.length ? <Text style={styles.hint}>Choose none to allow every service.</Text> : null}

        <Text style={styles.label}>Working hours</Text>
        <Text style={styles.muted}>{existing ? hoursSummary(existing.weeklyHours) : 'Follows the salon hours'}</Text>
        <Text style={styles.hint}>Setting custom hours is done on the website for now.</Text>

        {existing ? <SwitchRow label="Active" value={active} onValueChange={setActive} hint="Stopped staff cannot be chosen for new appointments." /> : null}
        <View style={styles.gap} />
        <Button title={existing ? 'Save changes' : 'Add staff'} onPress={submit} loading={save.isPending} />
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  banner: { color: COLORS.error, backgroundColor: '#fdecea', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 14 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.ink, marginTop: 8, marginBottom: 4 },
  muted: { fontSize: 14, color: COLORS.muted },
  hint: { fontSize: 12, color: COLORS.muted, marginTop: 4, marginBottom: 8 },
  error: { color: COLORS.error, fontSize: 13, marginBottom: 8 },
  gap: { height: 12 },
})
