import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button, Paper, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import { listPlatformUsers } from '../../api/platformApi'
import AdminQueryState from '../../components/admin/AdminQueryState'
import PageHeader from '../../components/admin/PageHeader'
import SearchField from '../../components/admin/SearchField'
import StatusPill from '../../components/admin/StatusPill'
import TablePager from '../../components/admin/TablePager'
import ResponsiveTable from '../../components/ResponsiveTable'

// Platform ke saare users aur kis salon me kis role me hain. Sirf padhna.
export default function AdminUsers() {
  const [page, setPage] = useState(1)
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const query = useQuery({ queryKey: ['platform', 'users', page, q], queryFn: () => listPlatformUsers({ page, q }), placeholderData: keepPreviousData })
  const users = query.data?.data.users ?? []
  const total = query.data?.meta?.total ?? 0

  return (
    <>
      <PageHeader title="Team & roles" subtitle={query.data ? `${total} user${total === 1 ? '' : 's'} and the salons they work in` : 'Everyone who can sign in to Galora.'} />
      <form
        role="search"
        className="ad-toolbar"
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          setQ(text.trim())
        }}
      >
        <SearchField value={text} onChange={setText} placeholder="Search by name or email" label="Search users" />
        <Button type="submit" variant="outlined">
          Search
        </Button>
      </form>

      <AdminQueryState query={query} isEmpty={users.length === 0} empty={{ icon: 'users', title: q ? 'No users match your search' : 'No users yet', text: q ? 'Try a different name or email.' : undefined }}>
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
                <TableRow key={u.id} hover>
                  <TableCell>
                    <div className="ad-cell">
                      <span className="ad-cell-strong">{u.name}</span>
                      {u.platformRole === 'admin' && (
                        <>
                          {' '}
                          <StatusPill label="Super Admin" tone="info" />
                        </>
                      )}
                      <span className="ad-cell-sub">{u.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.salons.length === 0
                      ? '—'
                      : u.salons.map((s) => (
                          <div key={s.salonId} className="ad-roles">
                            <RouterLink className="ad-link" to={`/admin/salons/${s.salonId}`}>
                              {s.salonName}
                            </RouterLink>
                            <StatusPill label={s.role} />
                          </div>
                        ))}
                  </TableCell>
                  <TableCell>
                    <StatusPill label={!u.active ? 'deactivated' : u.verified ? 'verified' : 'not verified'} tone={!u.active ? 'neutral' : u.verified ? 'success' : 'warning'} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </ResponsiveTable>
        </TableContainer>
        <TablePager page={page} total={total} onChange={setPage} noun="users" />
      </AdminQueryState>
    </>
  )
}
