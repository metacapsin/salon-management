import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  GlobalStyles,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { getInvoice, recordPayment, refundInvoice, voidInvoice } from '../api/billingApi'
import { friendlyError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { roleCan } from '../auth/permissions'
import QueryState from '../components/QueryState'
import { formatPaise } from '../utils/formatMoney'
import { InvoiceStatusChip } from './BillingPage'

const METHOD_LABEL = { cash: 'Cash', upi: 'UPI', card: 'Card' }
const dateTime = (iso) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// "1180.50" -> 118050 paise. Galat likha ho to null.
function rupeesToPaise(text) {
  const t = String(text).trim()
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const paise = Math.round(Number(t) * 100)
  return paise > 0 ? paise : null
}

// Payment / refund ka ek hi dialog (type se farak). requestKey dialog khulte hi ek baar banta hai: double click par ek hi entry.
function MoneyDialog({ type, invoice, onClose, onDone }) {
  const isRefund = type === 'refund'
  const max = isRefund ? invoice.amountPaid - invoice.amountRefunded : invoice.amountDue
  const [amount, setAmount] = useState((max / 100).toFixed(2))
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const requestKey = useMemo(() => `${type}-${crypto.randomUUID()}`, [type])
  const paise = rupeesToPaise(amount)
  const tooMuch = paise !== null && paise > max
  const noteOk = !isRefund || note.trim().length >= 3

  const save = useMutation({
    mutationFn: () => (isRefund ? refundInvoice : recordPayment)(invoice.id, { requestKey, method, amount: paise, reference: reference.trim(), note: note.trim() }),
    onSuccess: onDone,
    onError: (e) => setError(friendlyError(e)),
  })

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{isRefund ? 'Refund' : 'Record payment'}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        <Typography variant="body2" color="text.secondary">
          {isRefund ? `Received so far: ${formatPaise(max)}` : `Amount due: ${formatPaise(max)}`}
        </Typography>
        <TextField label="Amount (₹)" size="small" value={amount} onChange={(e) => setAmount(e.target.value)} error={amount !== '' && (paise === null || tooMuch)} helperText={paise === null && amount !== '' ? 'Enter an amount like 500 or 499.50.' : tooMuch ? `Cannot be more than ${formatPaise(max)}.` : ''} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
        <TextField select label="Method" size="small" value={method} onChange={(e) => setMethod(e.target.value)}>
          {Object.entries(METHOD_LABEL).map(([v, l]) => (
            <MenuItem key={v} value={v}>
              {l}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Reference (optional, e.g. UPI id)" size="small" value={reference} onChange={(e) => setReference(e.target.value)} slotProps={{ htmlInput: { maxLength: 80 } }} />
        <TextField label={isRefund ? 'Reason (required)' : 'Note (optional)'} size="small" value={note} onChange={(e) => setNote(e.target.value)} multiline slotProps={{ htmlInput: { maxLength: 300 } }} />
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color={isRefund ? 'error' : 'primary'} disabled={save.isPending || paise === null || tooMuch || !noteOk} onClick={() => { setError(''); save.mutate() }}>
          {save.isPending ? 'Saving…' : isRefund ? 'Refund' : 'Save payment'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function VoidDialog({ invoice, onClose, onDone }) {
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const save = useMutation({ mutationFn: () => voidInvoice(invoice.id, note.trim()), onSuccess: onDone, onError: (e) => setError(friendlyError(e)) })
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Void invoice {invoice.invoiceNumber}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        <Alert severity="warning">The bill stays in the records marked VOID. It cannot be undone. The appointment can then be billed again.</Alert>
        <TextField label="Reason (required)" size="small" value={note} onChange={(e) => setNote(e.target.value)} multiline slotProps={{ htmlInput: { maxLength: 300 } }} />
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" disabled={save.isPending || note.trim().length < 3} onClick={() => { setError(''); save.mutate() }}>
          Void invoice
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function Row({ label, value, bold }) {
  const sx = bold ? { fontWeight: 800, fontSize: '1.05rem' } : undefined
  return (
    <TableRow>
      <TableCell colSpan={3} align="right" sx={sx}>
        {label}
      </TableCell>
      <TableCell align="right" sx={sx}>
        {value < 0 ? `− ${formatPaise(-value)}` : formatPaise(value)}
      </TableCell>
    </TableRow>
  )
}

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { role, activeSalonId } = useAuth()
  const [dialog, setDialog] = useState(null) // 'payment' | 'refund' | 'void'
  const [notice, setNotice] = useState('')

  const query = useQuery({ queryKey: ['salon', activeSalonId, 'invoice', id], queryFn: () => getInvoice(id) })
  const inv = query.data?.invoice
  const payments = query.data?.payments ?? []
  const salon = query.data?.salon
  const net = inv ? inv.amountPaid - inv.amountRefunded : 0
  const final = inv?.status === 'final'

  const done = (message) => () => {
    setDialog(null)
    setNotice(message)
    queryClient.invalidateQueries({ queryKey: ['salon', activeSalonId] })
  }

  return (
    <Box>
      {/* Chhapte waqt sirf bill dikhe (sidebar, header, buttons nahi) */}
      <GlobalStyles styles={{ '@media print': { 'body *': { visibility: 'hidden' }, '#invoice-print, #invoice-print *': { visibility: 'visible' }, '#invoice-print': { position: 'absolute', left: 0, top: 0, width: '100%', boxShadow: 'none !important' }, '.no-print': { display: 'none !important' } } }} />
      <Box className="no-print" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Button onClick={() => navigate('/billing')}>← Back to billing</Button>
        <Box sx={{ flexGrow: 1 }} />
        {inv && final && roleCan(role, 'billing.write') && inv.amountDue > 0 && (
          <Button variant="contained" onClick={() => setDialog('payment')}>
            Record payment
          </Button>
        )}
        {inv && final && roleCan(role, 'billing.void') && net === 0 && (
          <Button color="error" onClick={() => setDialog('void')}>
            Void
          </Button>
        )}
        {inv && (
          <Button variant="outlined" onClick={() => window.print()}>
            Print
          </Button>
        )}
      </Box>
      {notice && (
        <Alert className="no-print" severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>
          {notice}
        </Alert>
      )}

      <QueryState query={query} isEmpty={!inv}>
        {inv && (
          <Paper id="invoice-print" sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) auto' }, gap: 2, mb: 2 }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {salon?.name}
                </Typography>
                {salon?.address && <Typography variant="body2">{salon.address}</Typography>}
                {(salon?.phone || salon?.email) && <Typography variant="body2">{[salon.phone, salon.email].filter(Boolean).join(' · ')}</Typography>}
              </Box>
              <Box sx={{ textAlign: { sm: 'right' } }}>
                <Typography variant="h6">{inv.status === 'void' ? 'INVOICE (VOID)' : inv.tax.total > 0 ? 'TAX INVOICE' : 'INVOICE'}</Typography>
                <Typography sx={{ fontWeight: 700 }}>{inv.invoiceNumber}</Typography>
                <Typography variant="body2">{dateTime(inv.createdAt)}</Typography>
                <Box sx={{ mt: 0.5 }}>
                  <InvoiceStatusChip invoice={inv} />
                </Box>
              </Box>
            </Box>

            <Typography variant="overline">Billed to</Typography>
            <Typography sx={{ fontWeight: 600 }}>{inv.customerName}</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {inv.customerPhone}
            </Typography>
            {inv.status === 'void' && <Alert severity="error" sx={{ mb: 2 }}>This invoice was voided. Reason: {inv.voidReason}</Alert>}

            <Table size="small" aria-label="Invoice items">
              <TableHead>
                <TableRow>
                  <TableCell>Service</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inv.lines.map((l) => (
                  <TableRow key={l.serviceId}>
                    <TableCell>
                      {l.name}
                      {l.package && (
                        <Typography variant="caption" sx={{ display: 'block' }}>
                          {l.package.sessions} covered by package {l.package.packageName}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{formatPaise(l.unitPrice)}</TableCell>
                    <TableCell align="right">{l.quantity}</TableCell>
                    <TableCell align="right">{formatPaise(l.lineTotal)}</TableCell>
                  </TableRow>
                ))}
                <Row label="Subtotal" value={inv.subtotal} />
                {inv.offer && <Row label={`Offer: ${inv.offer.title}`} value={-inv.offer.discount} />}
                {inv.membership && <Row label={`Membership: ${inv.membership.planName}`} value={-inv.membership.discount} />}
                {/* Naye bills me GST nahi lagta; sirf purane bills (jinme GST ban chuka he) me dikhta he, taaki unka total milta rahe */}
                {inv.tax.total > 0 && (
                  <>
                    <Row label="Amount before tax" value={inv.taxableAmount} />
                    <Row label={`CGST ${inv.tax.ratePercent / 2}%`} value={inv.tax.cgst} />
                    <Row label={`SGST ${inv.tax.ratePercent / 2}%`} value={inv.tax.sgst} />
                  </>
                )}
                <Row label="Total" value={inv.total} bold />
                <Row label="Paid" value={net} />
                <Row label="Amount due" value={inv.amountDue} bold />
              </TableBody>
            </Table>

            <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
              Payment history
            </Typography>
            {payments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No payments recorded yet.
              </Typography>
            ) : (
              <Table size="small" aria-label="Payment history">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Note</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{dateTime(p.createdAt)}</TableCell>
                      <TableCell>{p.type === 'refund' ? 'Refund' : 'Payment'}</TableCell>
                      <TableCell>{METHOD_LABEL[p.method]}</TableCell>
                      <TableCell>{[p.reference, p.note].filter(Boolean).join(' · ')}</TableCell>
                      <TableCell align="right">{p.type === 'refund' ? `− ${formatPaise(p.amount)}` : formatPaise(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
              This is a computer generated invoice.
            </Typography>
          </Paper>
        )}
      </QueryState>

      {dialog && inv && (dialog === 'void' ? (
        <VoidDialog invoice={inv} onClose={() => setDialog(null)} onDone={done('Invoice voided.')} />
      ) : (
        <MoneyDialog type={dialog} invoice={inv} onClose={() => setDialog(null)} onDone={done(dialog === 'refund' ? 'Refund recorded.' : 'Payment recorded.')} />
      ))}
    </Box>
  )
}
