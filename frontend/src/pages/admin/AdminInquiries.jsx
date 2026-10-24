import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Box, Chip, MenuItem, Pagination, Paper, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { listContactInquiries } from '../../api/platformApi'
import QueryState from '../../components/QueryState'
import { INQUIRY_STATUSES, statusInfo } from '../../data/inquiry'
import InquiryDialog from './InquiryDialog'
import ResponsiveTable from '../../components/ResponsiveTable'

const FILTER_FIELD_SX = { width: 150, '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } }

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
  const pageCount = Math.max(1, Math.ceil(total / 20))

  function setFilter(name, value) {
    setPage(1)
    setFilters((current) => ({ ...current, [name]: value }))
  }

  const cards = [
    { label: 'Total', value: counts?.total, status: '' },
    ...INQUIRY_STATUSES.map((s) => ({ label: s.label, value: counts?.[s.value], status: s.value })),
  ]

  return (
    <Box sx={{ maxWidth: 1200 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800, color: 'primary.main', mb: 0.5 }}>
        Contact inquiries
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Messages sent from the website Contact Us form.
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        {cards.map((c) => {
          const active = filters.status === c.status
          return (
            <Paper
              key={c.label}
              component="button"
              type="button"
              variant="outlined"
              onClick={() => setFilter('status', c.status)}
              aria-pressed={active}
              sx={{ px: 2, py: 1, minWidth: 110, textAlign: 'left', cursor: 'pointer', font: 'inherit', borderColor: active ? 'primary.main' : 'divider', borderWidth: active ? 2 : 1, bgcolor: 'background.paper' }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {c.label}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {c.value ?? '–'}
              </Typography>
            </Paper>
          )
        })}
      </Box>

      <Box
        component="form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          setFilter('q', text.trim())
        }}
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, alignItems: 'center' }}
      >
        <TextField size="small" label="Search" placeholder="Name, email, phone, message" value={text} onChange={(e) => setText(e.target.value)} sx={{ ...FILTER_FIELD_SX, width: 220 }} slotProps={{ htmlInput: { maxLength: 100 } }} />
        <TextField select size="small" label="Status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} sx={FILTER_FIELD_SX}>
          <MenuItem value="">All</MenuItem>
          {INQUIRY_STATUSES.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {s.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField size="small" type="date" label="From" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={FILTER_FIELD_SX} />
        <TextField size="small" type="date" label="To" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={FILTER_FIELD_SX} />
        <Box component="button" type="submit" sx={{ px: 2, py: 0.75, border: 0, borderRadius: 1, bgcolor: 'primary.main', color: 'primary.contrastText', cursor: 'pointer', font: 'inherit', fontSize: 13 }}>
          Search
        </Box>
      </Box>

      <QueryState query={query} isEmpty={inquiries.length === 0} empty={<Paper variant="outlined" sx={{ p: 3 }}>No inquiries match these filters.</Paper>}>
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
                      <Typography component="span" sx={{ fontWeight: 600 }}>
                        {i.name}
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block' }} color="text.secondary">
                        {i.email} · {i.phone}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 360 }}>
                      <Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>
                        {i.messagePreview}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={status.label} color={status.color} />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(i.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </ResponsiveTable>
        </TableContainer>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {total} inquir{total === 1 ? 'y' : 'ies'} found
        </Typography>
        {pageCount > 1 && <Pagination sx={{ mt: 1 }} count={pageCount} page={page} onChange={(_, p) => setPage(p)} />}
      </QueryState>

      {openId && <InquiryDialog id={openId} onClose={() => setOpenId(null)} />}
    </Box>
  )
}
