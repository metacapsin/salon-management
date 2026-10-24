import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Pagination,
  Paper,
  Snackbar,
  Switch,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import { fieldErrorsOf, friendlyError } from '../api/client'
import { inviteMember, listInvitations, listTeam, revokeInvitation, updateMember } from '../api/salonApi'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS, roleCan } from '../auth/permissions'
import QueryState from '../components/QueryState'
import { applyServerFieldErrors, inviteSchema } from '../utils/formSchemas'
import { field } from '../utils/muiForm'
import ResponsiveTable from '../components/ResponsiveTable'

const ROLE_OPTIONS = ['owner', 'manager', 'receptionist']

function InviteDialog({ open, onClose, onInvited }) {
  const [formError, setFormError] = useState('')
  const {
    register,
    handleSubmit,
    setError,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(inviteSchema), defaultValues: { email: '', role: 'receptionist' } })

  async function submit(values) {
    setFormError('')
    try {
      await inviteMember(values)
      reset()
      onInvited(values.email)
    } catch (error) {
      applyServerFieldErrors(fieldErrorsOf(error), setError)
      setFormError(friendlyError(error))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit(submit)} noValidate>
        <DialogTitle>Invite a team member</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField label="Email" type="email" autoComplete="off" {...field(register, errors, 'email')} />
          <TextField select label="Role" value={watch('role')} onChange={(e) => setValue('role', e.target.value)}>
            <MenuItem value="manager">Manager</MenuItem>
            <MenuItem value="receptionist">Receptionist</MenuItem>
          </TextField>
          <Typography variant="body2" color="text.secondary">
            They get an email with a link that works once and expires in 48 hours.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Send invitation'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

export default function TeamPage() {
  const { role, user, activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const canManage = roleCan(role, 'users.manage')
  const [page, setPage] = useState(1)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')

  const team = useQuery({ queryKey: ['salon', activeSalonId, 'team', page], queryFn: () => listTeam(page), placeholderData: keepPreviousData })
  const invites = useQuery({ queryKey: ['salon', activeSalonId, 'invitations'], queryFn: () => listInvitations(1), enabled: canManage })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['salon', activeSalonId] })

  const change = useMutation({
    mutationFn: ({ userId, body }) => updateMember(userId, body),
    onSuccess: () => {
      setActionError('')
      refresh()
    },
    onError: (error) => setActionError(error?.code === 'LAST_OWNER' ? 'A salon must keep at least one active owner. Make someone else an owner first.' : friendlyError(error)),
  })
  const revoke = useMutation({ mutationFn: revokeInvitation, onSuccess: refresh, onError: (error) => setActionError(friendlyError(error)) })

  const members = team.data?.data.members ?? []
  const pageCount = Math.max(1, Math.ceil((team.data?.meta?.total ?? 0) / 20))

  return (
    <Box sx={{ maxWidth: 1000 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800, color: 'primary.main', flexGrow: 1 }}>
          Team
        </Typography>
        {canManage && (
          <Button variant="contained" onClick={() => setInviteOpen(true)}>
            Invite member
          </Button>
        )}
      </Box>
      {!canManage && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You can see your team. Only the owner can invite people or change roles.
        </Alert>
      )}
      {actionError && (
        <Alert severity="error" onClose={() => setActionError('')} sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      <QueryState query={team} isEmpty={members.length === 0}>
        <TableContainer component={Paper}>
          <ResponsiveTable size="medium" aria-label="Team members">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map((m) => {
                const isMe = m.userId === user?.id
                return (
                  <TableRow key={m.userId}>
                    <TableCell>
                      {m.name} {isMe && <Chip size="small" label="You" sx={{ ml: 0.5 }} />}
                    </TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell sx={{ minWidth: 160 }}>
                      {canManage ? (
                        <TextField
                          select
                          size="small"
                          value={m.role}
                          onChange={(e) => change.mutate({ userId: m.userId, body: { role: e.target.value } })}
                          disabled={change.isPending}
                          slotProps={{ htmlInput: { 'aria-label': `Role for ${m.name}` } }}
                        >
                          {(ROLE_OPTIONS.includes(m.role) ? ROLE_OPTIONS : [...ROLE_OPTIONS, m.role]).map((r) => (
                            <MenuItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </MenuItem>
                          ))}
                        </TextField>
                      ) : (
                        ROLE_LABELS[m.role]
                      )}
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Switch
                            checked={m.active}
                            disabled={change.isPending}
                            onChange={(e) => change.mutate({ userId: m.userId, body: { active: e.target.checked } })}
                            slotProps={{ input: { 'aria-label': `${m.name} active` } }}
                          />
                          {m.active ? 'Active' : 'Deactivated'}
                        </Box>
                      ) : m.active ? (
                        'Active'
                      ) : (
                        'Deactivated'
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </ResponsiveTable>
        </TableContainer>
        {pageCount > 1 && <Pagination sx={{ mt: 2 }} count={pageCount} page={page} onChange={(_, p) => setPage(p)} />}
      </QueryState>

      {canManage && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
            Pending invitations
          </Typography>
          <QueryState query={invites} isEmpty={(invites.data?.data.invitations ?? []).length === 0} empty={<Typography color="text.secondary">No pending invitations.</Typography>}>
            <TableContainer component={Paper}>
              <ResponsiveTable size="small" aria-label="Pending invitations">
                <TableHead>
                  <TableRow>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Expires</TableCell>
                    <TableCell align="right">
                      <span style={{ position: 'absolute', left: -9999 }}>Actions</span>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(invites.data?.data.invitations ?? []).map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.email}</TableCell>
                      <TableCell>{ROLE_LABELS[i.role]}</TableCell>
                      <TableCell>{new Date(i.expiresAt).toLocaleString()}</TableCell>
                      <TableCell align="right">
                        <IconButton aria-label={`Cancel invitation for ${i.email}`} onClick={() => revoke.mutate(i.id)} disabled={revoke.isPending}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </ResponsiveTable>
            </TableContainer>
          </QueryState>
        </Box>
      )}

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={(email) => {
          setInviteOpen(false)
          setNotice(`Invitation sent to ${email}.`)
          refresh()
        }}
      />
      <Snackbar open={Boolean(notice)} autoHideDuration={5000} onClose={() => setNotice('')} message={notice} />
    </Box>
  )
}
