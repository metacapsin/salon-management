import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Box, Chip, Pagination, Paper, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { listPlatformUsers } from '../../api/platformApi'
import QueryState from '../../components/QueryState'
import ResponsiveTable from '../../components/ResponsiveTable'

// Platform ke saare users aur kis salon me kis role me hain. Sirf padhna.
export default function AdminUsers() {
  const [page, setPage] = useState(1)
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const query = useQuery({ queryKey: ['platform', 'users', page, q], queryFn: () => listPlatformUsers({ page, q }), placeholderData: keepPreviousData })
  const users = query.data?.data.users ?? []
  const total = query.data?.meta?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / 20))

  return (
    <Box sx={{ maxWidth: 1100 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800, color: 'primary.main', mb: 0.5 }}>
        Team &amp; roles
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {query.data ? `${total} user${total === 1 ? '' : 's'}` : ' '}
      </Typography>
      <Box
        component="form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          setQ(text.trim())
        }}
        sx={{ mb: 2 }}
      >
        <TextField size="small" label="Search" placeholder="Name or email" value={text} onChange={(e) => setText(e.target.value)} sx={{ width: 180, '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }} slotProps={{ htmlInput: { maxLength: 100 } }} />
      </Box>

      <QueryState query={query} isEmpty={users.length === 0}>
        <TableContainer component={Paper}>
          <ResponsiveTable size="small" aria-label="Users">
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Salons and roles</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Joined</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Typography component="span" sx={{ fontWeight: 600 }}>
                      {u.name}
                    </Typography>
                    {u.platformRole === 'admin' && <Chip size="small" label="Super Admin" color="primary" sx={{ ml: 1 }} />}
                    <Typography variant="caption" sx={{ display: 'block' }} color="text.secondary">
                      {u.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {u.salons.length === 0
                      ? '—'
                      : u.salons.map((s) => (
                          <Box key={s.salonId} sx={{ py: 0.25 }}>
                            <RouterLink to={`/admin/salons/${s.salonId}`} style={{ color: 'inherit' }}>
                              {s.salonName}
                            </RouterLink>{' '}
                            <Chip size="small" label={s.role} />
                          </Box>
                        ))}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={!u.active ? 'deactivated' : u.verified ? 'verified' : 'not verified'} color={u.active && u.verified ? 'success' : 'warning'} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(u.createdAt).toLocaleDateString()}</TableCell>
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
