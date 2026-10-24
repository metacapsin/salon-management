import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, Chip, MenuItem, Pagination, Paper, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { approveOwnerRequest, listOwnerRequests, rejectOwnerRequest } from '../../api/platformApi'
import { friendlyError } from '../../api/client'
import QueryState from '../../components/QueryState'
import ResponsiveTable from '../../components/ResponsiveTable'

const TONE = { pending: 'warning', approved: 'success', rejected: 'default' }

// Naye owners ki "Create owner account" requests. Approve karte hi unhe "approved, sign in" email jaati he.
export default function AdminOwnerRequests() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('pending')
  const query = useQuery({ queryKey: ['platform', 'owner-requests', page, status], queryFn: () => listOwnerRequests({ page, status }), placeholderData: keepPreviousData })
  const requests = query.data?.data.requests ?? []
  const total = query.data?.meta?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / 20))

  const act = useMutation({
    mutationFn: ({ id, action }) => (action === 'approve' ? approveOwnerRequest(id) : rejectOwnerRequest(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform', 'owner-requests'] }),
  })

  return (
    <Box sx={{ maxWidth: 1100 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800, color: 'primary.main', mb: 0.5 }}>
        Owner requests
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Approve karte hi owner ko email jaati he aur wo seedha login kar sakta he.
      </Typography>

      <TextField
        select
        size="small"
        label="Status"
        value={status}
        onChange={(e) => {
          setPage(1)
          setStatus(e.target.value)
        }}
        sx={{ width: 130, mb: 2 }}
      >
        <MenuItem value="pending">Pending</MenuItem>
        <MenuItem value="approved">Approved</MenuItem>
        <MenuItem value="rejected">Rejected</MenuItem>
      </TextField>

      {act.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {friendlyError(act.error)}
        </Alert>
      )}

      <QueryState query={query} isEmpty={requests.length === 0} empty={<Alert severity="info">No {status} requests.</Alert>}>
        <TableContainer component={Paper}>
          <ResponsiveTable size="small" aria-label="Owner requests">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Requested</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((r) => {
                const busy = act.isPending && act.variables?.id === r.id
                return (
                  <TableRow key={r.id} hover>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>{new Date(r.requestedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Chip size="small" color={TONE[r.status]} label={r.status === 'approved' && r.verified ? 'approved · verified' : r.status} />
                    </TableCell>
                    <TableCell align="right">
                      {r.status !== 'approved' && (
                        <Button size="small" variant="contained" disabled={busy} onClick={() => act.mutate({ id: r.id, action: 'approve' })} sx={{ mr: 1 }}>
                          Approve
                        </Button>
                      )}
                      {r.status === 'approved' && (
                        <Button size="small" variant="outlined" disabled={busy} onClick={() => act.mutate({ id: r.id, action: 'approve' })} sx={{ mr: 1 }}>
                          Resend email
                        </Button>
                      )}
                      {r.status === 'pending' && (
                        <Button size="small" color="error" disabled={busy} onClick={() => act.mutate({ id: r.id, action: 'reject' })}>
                          Reject
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </ResponsiveTable>
        </TableContainer>
        {pageCount > 1 && <Pagination count={pageCount} page={page} onChange={(_, p) => setPage(p)} sx={{ mt: 2 }} />}
      </QueryState>
    </Box>
  )
}
