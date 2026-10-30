import { MenuItem, Select } from '@mui/material'

// Browser ke purane native <select> ki jagah MUI ka dropdown (baaki sab "TextField select" jaisa hi menu khulta hai).
// options = [{ value, label }]. Khaali value ("") wala option placeholder ka kaam karta hai. onChange ko event milta hai (e.target.value).
export default function SelectBox({ id, value, onChange, options, disabled, error, size = 'medium', sx, ...rest }) {
  return (
    <Select
      id={id}
      value={value}
      onChange={onChange}
      disabled={disabled}
      error={error}
      size={size}
      displayEmpty
      fullWidth
      sx={sx}
      MenuProps={{ slotProps: { paper: { sx: { maxHeight: 320, borderRadius: '12px', mt: 0.5 } } } }}
      {...rest}
    >
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </Select>
  )
}
