import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Alert, Button, MenuItem, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Paper } from '@mui/material'
import { listPlatformSalons } from '../../api/platformApi'
import AdminQueryState from '../../components/admin/AdminQueryState'
import PageHeader from '../../components/admin/PageHeader'
import SearchField from '../../components/admin/SearchField'
import StatusPill from '../../components/admin/StatusPill'
import TablePager from '../../components/admin/TablePager'
import ResponsiveTable from '../../components/ResponsiveTable'
import CreateSalonDialog from '../../features/admin/CreateSalonDialog'

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
  const filtered = Boolean(q || status)

  return (
    <>
      <PageHeader
        title="Salons"
        subtitle={query.data ? `${total} salon${total === 1 ? '' : 's'} on the platform` : 'Every salon registered on Galora.'}
        actions={
          <Button variant="contained" onClick={() => setCreating(true)}>
            Create salon
          </Button>
        }
      />
      {notice && (
        <Alert severity={notice.emailSent && !notice.photosFailed ? 'success' : 'warning'} onClose={() => setNotice(null)} sx={{ mb: 2 }}>
          {notice.emailSent
            ? `Salon created. A welcome email was sent to ${notice.email}.`
            : `Salon created, but the email to ${notice.email} could not be sent. Please tell the owner their sign-in details yourself.`}
          {notice.photosFailed ? ` ${notice.photosFailed} photo(s) could not be uploaded.` : ''}
        </Alert>
      )}
      {creating && <CreateSalonDialog onClose={() => setCreating(false)} onCreated={setNotice} />}

      <form
        role="search"
        className="ad-toolbar"
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          setQ(text.trim())
        }}
      >
        <SearchField value={text} onChange={setText} placeholder="Search by name, city or owner" label="Search salons" />
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
          <MenuItem value="">All</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="suspended">Suspended</MenuItem>
        </TextField>
        <Button type="submit" variant="outlined">
          Search
        </Button>
      </form>

      <AdminQueryState
        query={query}
        isEmpty={salons.length === 0}
        empty={{ icon: 'store', title: filtered ? 'No salons match your search' : 'No salons yet', text: filtered ? 'Try a different name, city or status.' : 'Salons appear here once an owner registers or you create one.' }}
      >
        <TableContainer component={Paper}>
          <ResponsiveTable size="small" aria-label="Salons">
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 220 }}>Salon</TableCell>
                <TableCell>City</TableCell>
                <TableCell sx={{ minWidth: 230 }}>Owner</TableCell>
                <TableCell>Team</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Registered</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {salons.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>
                    <div className="ad-cell">
                      <RouterLink className="ad-link" to={`/admin/salons/${s.id}`}>
                        {s.name}
                      </RouterLink>
                      <span className="ad-cell-sub">{s.slug}</span>
                    </div>
                  </TableCell>
                  <TableCell>{s.city || '—'}</TableCell>
                  <TableCell>
                    <div className="ad-cell">
                      <span className="ad-cell-strong">{s.ownerName || '—'}</span>
                      {s.ownerEmail && <span className="ad-cell-sub">{s.ownerEmail}</span>}
                    </div>
                  </TableCell>
                  <TableCell>{s.memberCount}</TableCell>
                  <TableCell>
                    <StatusPill label={s.status} tone={s.status === 'active' ? 'success' : 'warning'} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(s.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </ResponsiveTable>
        </TableContainer>
        <TablePager page={page} total={total} onChange={setPage} noun="salons" />
      </AdminQueryState>
    </>
  )
}
