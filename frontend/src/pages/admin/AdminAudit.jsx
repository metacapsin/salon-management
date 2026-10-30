import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Paper, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import { listPlatformAudit } from '../../api/platformApi'
import AdminQueryState from '../../components/admin/AdminQueryState'
import PageHeader from '../../components/admin/PageHeader'
import TablePager from '../../components/admin/TablePager'
import ResponsiveTable from '../../components/ResponsiveTable'

// Saare salons ki audit history ek jagah. Sirf padhna; koi edit/delete nahi.
export default function AdminAudit() {
  const [page, setPage] = useState(1)
  const query = useQuery({ queryKey: ['platform', 'audit', page], queryFn: () => listPlatformAudit({ page }), placeholderData: keepPreviousData })
  const events = query.data?.data.events ?? []
  const total = query.data?.meta?.total ?? 0

  return (
    <>
      <PageHeader title="Audit history" subtitle="A read-only record of important actions across every salon." />
      <AdminQueryState query={query} isEmpty={events.length === 0} empty={{ icon: 'history', title: 'No activity recorded yet', text: 'Actions taken by salon teams and admins will be listed here.' }}>
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
                <TableRow key={e.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(e.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{e.salonName ?? '—'}</TableCell>
                  <TableCell>{e.actorName ?? 'System'}</TableCell>
                  <TableCell className="ad-cell-strong">{e.action}</TableCell>
                  <TableCell sx={{ maxWidth: 320, wordBreak: 'break-word' }} className="ad-cell-muted">
                    {Object.keys(e.changes ?? {}).length ? JSON.stringify(e.changes) : ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </ResponsiveTable>
        </TableContainer>
        <TablePager page={page} total={total} onChange={setPage} noun="events" />
      </AdminQueryState>
    </>
  )
}
