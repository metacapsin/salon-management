import { Dialog, DialogContent, IconButton } from '@mui/material'
import CustomerLoginForm from './CustomerLoginForm'

// Book Now dabane par login ka popup (alag page nahi). Login hote hi onDone chalta hai aur booking page khul jaata hai.
export default function LoginDialog({ salon, onDone, onClose }) {
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-label="Log in to book this salon">
      <IconButton onClick={onClose} aria-label="Close" sx={{ position: 'absolute', top: 8, right: 8 }}>
        ✕
      </IconButton>
      <DialogContent sx={{ p: { xs: 3, sm: 4 } }}>
        <CustomerLoginForm intro={`Log in with your mobile number to book ${salon.name}.`} onDone={onDone} />
      </DialogContent>
    </Dialog>
  )
}
