import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, Chip, Dialog, DialogContent, DialogTitle, Divider, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { addContactInquiryNote, getContactInquiry, setContactInquiryStatus } from '../../api/platformApi'
import { friendlyError } from '../../api/client'
import QueryState from '../../components/QueryState'
import { INQUIRY_STATUSES, statusInfo } from '../../data/inquiry'

// Ek inquiry ki poori detail: message, customer se contact, status, admin notes.
export default function InquiryDialog({ id, onClose }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const query = useQuery({ queryKey: ['platform', 'inquiry', id], queryFn: () => getContactInquiry(id) })
  const inquiry = query.data

  // Badlav ke baad detail aur list (cards ki ginti samet) dono taaza karte hain
  const saved = (fresh) => {
    queryClient.setQueryData(['platform', 'inquiry', id], fresh)
    queryClient.invalidateQueries({ queryKey: ['platform', 'inquiries'] })
  }
  const statusMutation = useMutation({ mutationFn: (status) => setContactInquiryStatus(id, status), onSuccess: saved })
  const noteMutation = useMutation({
    mutationFn: (text) => addContactInquiryNote(id, text),
    onSuccess: (fresh) => {
      saved(fresh)
      setNote('')
    },
  })

  const error = statusMutation.error ?? noteMutation.error

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="inquiry-title">
      <DialogTitle id="inquiry-title">Inquiry details</DialogTitle>
      <DialogContent dividers>
        <QueryState query={query} isEmpty={!inquiry}>
          {inquiry && (
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {inquiry.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                  <Chip size="small" label={statusInfo(inquiry.status).label} color={statusInfo(inquiry.status).color} />
                  <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                    Received {new Date(inquiry.createdAt).toLocaleString()}
                  </Typography>
                </Box>
              </Box>

              <Box>
                <Typography variant="body2">{inquiry.email}</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {inquiry.phone}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" component="a" href={`mailto:${inquiry.email}?subject=${encodeURIComponent('Your message to Glamora')}`}>
                    Email customer
                  </Button>
                  <Button size="small" variant="outlined" component="a" href={`tel:${inquiry.phone.replace(/[^\d+]/g, '')}`}>
                    Call customer
                  </Button>
                </Stack>
              </Box>

              <MessageBox>{inquiry.message}</MessageBox>

              <TextField select size="small" label="Status" value={inquiry.status} disabled={statusMutation.isPending} onChange={(e) => statusMutation.mutate(e.target.value)} sx={{ maxWidth: 220 }}>
                {INQUIRY_STATUSES.map((s) => (
                  <MenuItem key={s.value} value={s.value}>
                    {s.label}
                  </MenuItem>
                ))}
              </TextField>

              <Divider />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Admin notes (private)
              </Typography>
              {inquiry.notes.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No notes yet.
                </Typography>
              )}
              {inquiry.notes.map((n) => (
                <Box key={n.id}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {n.text}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {n.authorName || 'Admin'} · {new Date(n.createdAt).toLocaleString()}
                  </Typography>
                </Box>
              ))}
              <Box
                component="form"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (note.trim() && !noteMutation.isPending) noteMutation.mutate(note.trim())
                }}
                sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}
              >
                <TextField size="small" fullWidth multiline minRows={2} label="Add a note" value={note} onChange={(e) => setNote(e.target.value)} slotProps={{ htmlInput: { maxLength: 1000 } }} />
                <Button type="submit" variant="contained" disabled={!note.trim() || noteMutation.isPending}>
                  Add
                </Button>
              </Box>

              {error && <Alert severity="error">{friendlyError(error)}</Alert>}
            </Stack>
          )}
        </QueryState>
      </DialogContent>
      <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={onClose}>Close</Button>
      </Box>
    </Dialog>
  )
}

// Customer ka message: line breaks bachakar, lambe shabd tootkar dikhata hai
function MessageBox({ children }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      <Typography variant="body2">{children}</Typography>
    </Box>
  )
}
