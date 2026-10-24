import { Dialog, DialogContent, IconButton } from '@mui/material'
import CustomerLoginForm from './CustomerLoginForm'

// Salon par click karne par login ka popup (alag page nahi). Login hote hi onDone chalta hai aur salon khul jaata hai.
export default function LoginDialog({ salon, onDone, onClose }) {
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-label="Log in to view this salon">
      <IconButton onClick={onClose} aria-label="Close" sx={{ position: 'absolute', top: 8, right: 8 }}>
        ✕
      </IconButton>
      <DialogContent sx={{ p: { xs: 3, sm: 4 } }}>
        <CustomerLoginForm intro={`Log in with your mobile number to view ${salon.name}. The salon will know you are interested.`} onDone={onDone} />
      </DialogContent>
    </Dialog>
  )
}
