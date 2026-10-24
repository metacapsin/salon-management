import { IconButton } from '@mui/material'

// Popup ke upar-right kone me band karne ka ✕ button. Dialog ke andar sabse pehle rakho.
export default function DialogCloseButton({ onClose }) {
  return (
    <IconButton aria-label="Close" size="small" onClick={onClose} sx={{ position: 'absolute', top: 14, right: 14, zIndex: 1, width: 28, height: 28, fontSize: 14 }}>
      ✕
    </IconButton>
  )
}
