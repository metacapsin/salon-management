import { InputAdornment, TextField } from '@mui/material'
import Icon from '../Icon'

// Admin ki tables ke upar ka search box: icon ke saath, ek jaisi height (40px). Enter dabane par parent ka <form> submit hota he.
export default function SearchField({ value, onChange, placeholder = 'Search', label = 'Search', maxLength = 100 }) {
  return (
    <TextField
      className="ad-search"
      size="small"
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      slotProps={{
        htmlInput: { maxLength, 'aria-label': label },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Icon name="search" size={18} />
            </InputAdornment>
          ),
        },
      }}
    />
  )
}
