import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Alert, Box, Button, Chip, MenuItem, Pagination, Paper, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { listPlatformSalons } from '../../api/platformApi'
import QueryState from '../../components/QueryState'
import CreateSalonDialog from '../../features/admin/CreateSalonDialog'
import ResponsiveTable from '../../components/ResponsiveTable'

// Galora par registered saare salons. Search aur status filter server par chalta he.
export default function AdminSalons() {
  const [page, setPage] = useState(1)
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState(null) // salon banne ke baad email ka haal
  const query = useQuery({ queryKey: ['platform', 'salons', page, q, status], queryFn: () => listPlatformSalons({ page, q, status }), placeholderData: keepPreviousData })
  const salons = query.data?.data.salons ?? []
  const total = query.data?.meta?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / 20))

  return (
    <Box sx={{ maxWidth: 1100 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, color: 'primary.main', mb: 0.5 }}>
            Salons
          </Typography>
          <Typography color="text.secondary">{query.data ? `${total} salon${total === 1 ? '' : 's'}` : ' '}</Typography>
        </Box>
        <Button variant="contained" onClick={() => setCreating(true)}>
          Create salon
        </Button>
      </Box>
      {notice && (
        <Alert severity={notice.emailSent ? 'success' : 'warning'} onClose={() => setNotice(null)} sx={{ mb: 2 }}>
          {notice.emailSent
            ? `Salon created. A welcome email was sent to ${notice.email}.`
            : `Salon created, but the email to ${notice.email} could not be sent. Please tell the owner their sign-in details yourself.`}
        </Alert>
      )}
      {creating && <CreateSalonDialog onClose={() => setCreating(false)} onCreated={setNotice} />}

      <Box
        component="form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          setQ(text.trim())
        }}
        sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}
      >
        <TextField size="small" label="Search" placeholder="Name, city, owner" value={text} onChange={(e) => setText(e.target.value)} sx={{ width: 180, '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }} slotProps={{ htmlInput: { maxLength: 100 } }} />
        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(e) => {
            setPage(1)
            setStatus(e.target.value)
          }}
          sx={{ width: 110, '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="suspended">Suspended</MenuItem>
        </TextField>
      </Box>

      <QueryState query={query} isEmpty={salons.length === 0}>
        <TableContainer component={Paper}>
          <ResponsiveTable size="small" aria-label="Salons">
            <TableHead>
              <TableRow>
                <TableCell>Salon</TableCell>
                <TableCell>City</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Team</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Registered</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {salons.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>
                    <RouterLink to={`/admin/salons/${s.id}`}>{s.name}</RouterLink>
                    <Typography variant="caption" sx={{ display: 'block' }} color="text.secondary">
                      {s.slug}
                    </Typography>
                  </TableCell>
                  <TableCell>{s.city || '—'}</TableCell>
                  <TableCell>
                    {s.ownerName || '—'}
                    <Typography variant="caption" sx={{ display: 'block' }} color="text.secondary">
                      {s.ownerEmail}
                    </Typography>
                  </TableCell>
                  <TableCell>{s.memberCount}</TableCell>
                  <TableCell>
                    <Chip size="small" label={s.status} color={s.status === 'active' ? 'success' : 'warning'} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(s.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </ResponsiveTable>
        </TableContainer>
        {pageCount > 1 && <Pagination sx={{ mt: 2 }} count={pageCount} page={page} onChange={(_, p) => setPage(p)} />}
      </QueryState>
    </Box>
  )
}
