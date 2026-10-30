import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button, MenuItem, Paper, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { listContactInquiries } from '../../api/platformApi'
import AdminQueryState from '../../components/admin/AdminQueryState'
import PageHeader from '../../components/admin/PageHeader'
import SearchField from '../../components/admin/SearchField'
import StatusPill from '../../components/admin/StatusPill'
import TablePager from '../../components/admin/TablePager'
import { INQUIRY_STATUSES, statusInfo } from '../../data/inquiry'
import InquiryDialog from './InquiryDialog'
import ResponsiveTable from '../../components/ResponsiveTable'

// Website ke Contact Us form se aaye sawaal: dekho, filter karo, status badlo, notes likho, customer se baat karo.
export default function AdminInquiries() {
  const [page, setPage] = useState(1)
  const [text, setText] = useState('')
  const [filters, setFilters] = useState({ q: '', status: '', from: '', to: '' })
  const [openId, setOpenId] = useState(null)

  const query = useQuery({
    queryKey: ['platform', 'inquiries', page, filters],
    queryFn: () => listContactInquiries({ page, ...filters }),
    placeholderData: keepPreviousData,
  })
  const inquiries = query.data?.data.inquiries ?? []
  const counts = query.data?.data.counts
  const total = query.data?.meta?.total ?? 0

  function setFilter(name, value) {
    setPage(1)
    setFilters((current) => ({ ...current, [name]: value }))
  }

  const cards = [
    { label: 'Total', value: counts?.total, status: '' },
    ...INQUIRY_STATUSES.map((s) => ({ label: s.label, value: counts?.[s.value], status: s.value })),
  ]

  return (
    <>
      <PageHeader title="Contact inquiries" subtitle="Messages sent from the website Contact Us form." />

      <div className="ad-filtercards" role="group" aria-label="Filter by status">
        {cards.map((c) => (
          <button key={c.label} type="button" className="ad-filtercard" onClick={() => setFilter('status', c.status)} aria-pressed={filters.status === c.status}>
            <span>{c.label}</span>
            <strong>{c.value ?? '–'}</strong>
          </button>
        ))}
      </div>

      <form
        role="search"
        className="ad-toolbar"
        onSubmit={(e) => {
          e.preventDefault()
          setFilter('q', text.trim())
        }}
      >
        <SearchField value={text} onChange={setText} placeholder="Search name, email, phone or message" label="Search inquiries" />
        <TextField select size="small" label="Status" className="ad-filter" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <MenuItem value="">All</MenuItem>
          {INQUIRY_STATUSES.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {s.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField size="small" type="date" label="From" className="ad-filter ad-filter--date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" type="date" label="To" className="ad-filter ad-filter--date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <Button type="submit" variant="outlined">
          Search
        </Button>
      </form>

      <AdminQueryState query={query} isEmpty={inquiries.length === 0} empty={{ icon: 'mail', title: 'No inquiries match these filters', text: 'Change the status, dates or search words to see more.' }}>
        <TableContainer component={Paper}>
          <ResponsiveTable size="small" aria-label="Contact inquiries">
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell>Message</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Received</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inquiries.map((i) => {
                const status = statusInfo(i.status)
                return (
                  <TableRow key={i.id} hover tabIndex={0} onClick={() => setOpenId(i.id)} onKeyDown={(e) => e.key === 'Enter' && setOpenId(i.id)} sx={{ cursor: 'pointer' }}>
                    <TableCell>
                      <div className="ad-cell">
                        <span className="ad-cell-strong">{i.name}</span>
                        <span className="ad-cell-sub">
                          {i.email} · {i.phone}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 360 }}>
                      <Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>
                        {i.messagePreview}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusPill label={status.label} tone={status.color} />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(i.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </ResponsiveTable>
        </TableContainer>
        <TablePager page={page} total={total} onChange={setPage} noun="inquiries" />
      </AdminQueryState>

      {openId && <InquiryDialog id={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
