import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Box, Pagination, Paper, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { listPlatformAudit } from '../../api/platformApi'
import QueryState from '../../components/QueryState'
import ResponsiveTable from '../../components/ResponsiveTable'

// Saare salons ki audit history ek jagah. Sirf padhna; koi edit/delete nahi.
export default function AdminAudit() {
  const [page, setPage] = useState(1)
  const query = useQuery({ queryKey: ['platform', 'audit', page], queryFn: () => listPlatformAudit({ page }), placeholderData: keepPreviousData })
  const events = query.data?.data.events ?? []
  const pageCount = Math.max(1, Math.ceil((query.data?.meta?.total ?? 0) / 20))

  return (
    <Box sx={{ maxWidth: 1100 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800, color: 'primary.main', mb: 2 }}>
        Audit history
      </Typography>
      <QueryState query={query} isEmpty={events.length === 0}>
        <TableContainer component={Paper}>
          <ResponsiveTable size="small" aria-label="Platform audit history">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Salon</TableCell>
                <TableCell>Who</TableCell>
                <TableCell>What</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(e.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{e.salonName ?? '—'}</TableCell>
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
