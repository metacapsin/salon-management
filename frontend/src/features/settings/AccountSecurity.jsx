import { useState } from 'react'
import { Alert, Box, Button, IconButton, InputAdornment, Snackbar, TextField, Typography } from '@mui/material'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { changePassword } from '../../api/authApi'
import { fieldErrorsOf, friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'

const EMPTY = { currentPassword: '', newPassword: '', confirm: '' }

// Apna password badalna + logout. Ye har role ka apna account he, isliye Manager/Staff ke liye bhi chalta he (readOnly se bandh nahi).
export default function AccountSecurity() {
  const { user, logout } = useAuth()
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [show, setShow] = useState(false)

  const set = (key) => (event) => {
    setValues((prev) => ({ ...prev, [key]: event.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate() {
    const next = {}
    if (!values.currentPassword) next.currentPassword = 'Enter your current password.'
    if (values.newPassword.length < 12) next.newPassword = 'Password must be at least 12 characters.'
    else if (values.newPassword.length > 128) next.newPassword = 'Password can be at most 128 characters.'
    else if (values.newPassword === values.currentPassword) next.newPassword = 'Must be different from your current password.'
    if (values.confirm !== values.newPassword) next.confirm = 'Passwords do not match.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit(event) {
    event.preventDefault()
    setFormError('')
    if (!validate()) return
    setSaving(true)
    try {
      await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword })
      setValues(EMPTY)
      setDone(true)
    } catch (error) {
      setErrors(fieldErrorsOf(error) ?? {})
      setFormError(friendlyError(error))
    } finally {
      setSaving(false)
    }
  }

  const dirty = Boolean(values.currentPassword || values.newPassword || values.confirm)
  const type = show ? 'text' : 'password'
  const eye = {
    input: {
      endAdornment: (
        <InputAdornment position="end">
          <IconButton size="small" aria-label={show ? 'Hide passwords' : 'Show passwords'} onClick={() => setShow((v) => !v)} edge="end">
            {show ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
          </IconButton>
        </InputAdornment>
      ),
    },
  }

  return (
    <Box sx={{ display: 'grid', gap: { xs: 2.5, md: 4 }, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1.2fr)' }, alignItems: 'start' }}>
      <Box sx={{ display: 'grid', gap: 2 }}>
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Signed in as
          </Typography>
          <Typography sx={{ fontWeight: 700 }}>{user?.name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {user?.email}
          </Typography>
        </Box>
        <Box>
          <Button variant="outlined" color="error" size="small" onClick={logout} sx={{ textTransform: 'none' }}>
            Log out
          </Button>
        </Box>
      </Box>

      <Box component="form" onSubmit={submit} noValidate sx={{ display: 'grid', gap: 1.25, maxWidth: 400 }}>
        <Typography variant="subtitle2">Change password</Typography>
        {formError && <Alert severity="error">{formError}</Alert>}
        <TextField size="small" label="Current password" type={type} autoComplete="current-password" value={values.currentPassword} onChange={set('currentPassword')} error={Boolean(errors.currentPassword)} helperText={errors.currentPassword} slotProps={eye} />
        <TextField size="small" label="New password" type={type} autoComplete="new-password" value={values.newPassword} onChange={set('newPassword')} error={Boolean(errors.newPassword)} helperText={errors.newPassword ?? 'At least 12 characters.'} slotProps={eye} />
        <TextField size="small" label="Confirm new password" type={type} autoComplete="new-password" value={values.confirm} onChange={set('confirm')} error={Boolean(errors.confirm)} helperText={errors.confirm} slotProps={eye} />
        <Typography variant="caption" color="text.secondary">
          Other devices where you are signed in will be signed out. This device stays signed in.
        </Typography>
        <Box>
          <Button type="submit" variant="contained" disabled={saving || !dirty} sx={{ textTransform: 'none', fontWeight: 700, px: 3 }}>
            {saving ? 'Saving…' : 'Update password'}
          </Button>
        </Box>
      </Box>

      <Snackbar open={done} autoHideDuration={4000} onClose={() => setDone(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setDone(false)}>
          Password updated.
        </Alert>
      </Snackbar>
    </Box>
  )
}
