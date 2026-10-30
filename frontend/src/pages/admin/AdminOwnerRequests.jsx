import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, MenuItem, Paper, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from '@mui/material'
import { approveOwnerRequest, listOwnerRequests, rejectOwnerRequest } from '../../api/platformApi'
import { friendlyError } from '../../api/client'
import AdminQueryState from '../../components/admin/AdminQueryState'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import TablePager from '../../components/admin/TablePager'
import ResponsiveTable from '../../components/ResponsiveTable'

const TONE = { pending: 'warning', approved: 'success', rejected: 'neutral' }

// Naye owners ki "Create owner account" requests. Approve karte hi unhe "approved, sign in" email jaati he.
export default function AdminOwnerRequests() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('pending')
  const query = useQuery({ queryKey: ['platform', 'owner-requests', page, status], queryFn: () => listOwnerRequests({ page, status }), placeholderData: keepPreviousData })
  const requests = query.data?.data.requests ?? []
  const total = query.data?.meta?.total ?? 0

  const act = useMutation({
    mutationFn: ({ id, action }) => (action === 'approve' ? approveOwnerRequest(id) : rejectOwnerRequest(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform', 'owner-requests'] }),
  })

  return (
    <>
      <PageHeader title="Owner requests" subtitle="Approving a request emails the owner, who can then sign in and set up their salon." />

      <div className="ad-toolbar">
        <TextField
          select
          size="small"
          label="Status"
          className="ad-filter"
          value={status}
          onChange={(e) => {
            setPage(1)
            setStatus(e.target.value)
          }}
        >
          <MenuItem value="pending">Pending</MenuItem>
          <MenuItem value="approved">Approved</MenuItem>
          <MenuItem value="rejected">Rejected</MenuItem>
        </TextField>
      </div>

      {act.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {friendlyError(act.error)}
        </Alert>
      )}

      <AdminQueryState query={query} isEmpty={requests.length === 0} empty={{ icon: 'userCheck', title: `No ${status} requests`, text: status === 'pending' ? 'New owner sign-ups that need your approval will appear here.' : 'Nothing to show for this status.' }}>
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
                    <TableCell className="ad-cell-strong">{r.name}</TableCell>
                    <TableCell sx={{ overflowWrap: 'anywhere' }}>{r.email}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(r.requestedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <StatusPill tone={TONE[r.status]} label={r.status === 'approved' && r.verified ? 'approved · verified' : r.status} />
                    </TableCell>
                    <TableCell align="right">
                      <div className="ad-row-actions">
                        {r.status !== 'approved' && (
                          <Button size="small" variant="contained" disabled={busy} onClick={() => act.mutate({ id: r.id, action: 'approve' })}>
                            Approve
                          </Button>
                        )}
                        {r.status === 'approved' && (
                          <Button size="small" variant="outlined" disabled={busy} onClick={() => act.mutate({ id: r.id, action: 'approve' })}>
                            Resend email
                          </Button>
                        )}
                        {r.status === 'pending' && (
                          <Button size="small" variant="outlined" color="error" disabled={busy} onClick={() => act.mutate({ id: r.id, action: 'reject' })}>
                            Reject
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </ResponsiveTable>
        </TableContainer>
        <TablePager page={page} total={total} onChange={setPage} noun="requests" />
      </AdminQueryState>
    </>
  )
}
