import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Box, Pagination, Paper, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { listAudit } from '../api/salonApi'
import { useAuth } from '../auth/AuthContext'
import QueryState from '../components/QueryState'
import ResponsiveTable from '../components/ResponsiveTable'

// Audit history (Owner/Manager). Sirf padhna; koi edit/delete nahi (SRS FR-AUD-02).
export default function AuditPage() {
  const { activeSalonId } = useAuth()
  const [page, setPage] = useState(1)
  const query = useQuery({ queryKey: ['salon', activeSalonId, 'audit', page], queryFn: () => listAudit(page), placeholderData: keepPreviousData })
  const events = query.data?.data.events ?? []
  const pageCount = Math.max(1, Math.ceil((query.data?.meta?.total ?? 0) / 20))

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        A record of who changed what in your salon.
      </Typography>
      <QueryState query={query} isEmpty={events.length === 0}>
        <TableContainer component={Paper}>
          <ResponsiveTable size="small" aria-label="Audit history">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Who</TableCell>
                <TableCell>What</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(e.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{e.actorName ?? 'System'}</TableCell>
                  <TableCell>{e.action}</TableCell>
                  <TableCell sx={{ maxWidth: 320, wordBreak: 'break-word' }}>{Object.keys(e.changes ?? {}).length ? JSON.stringify(e.changes) : ''}</TableCell>
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
