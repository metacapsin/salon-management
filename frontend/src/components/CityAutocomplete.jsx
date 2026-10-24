import { Autocomplete, TextField } from '@mui/material'
import { INDIAN_CITIES } from '../data/indianCities'

// City likhte hi suggestions (poora India). Props:
//   value (string), onChange(cityName), extraCities (database ke shehar, jo list me na hon)
//   freeSolo: true ho to list se bahar ka shehar bhi likh sakte hain (salon owner ke liye)
//   salonCounts: { Delhi: 8 } -> suggestion ke saath "8 salons" dikhata hai
export default function CityAutocomplete({ value, onChange, extraCities = [], salonCounts = {}, freeSolo = false, label = 'City', disabled, error, helperText, onBlur, size, placeholder }) {
  const known = new Set(INDIAN_CITIES.map((c) => c.city.toLowerCase()))
  const options = [
    ...INDIAN_CITIES.map((c) => c.city),
    ...extraCities.filter((c) => !known.has(c.toLowerCase())),
  ]
  // Jin shehron me salon hain wo upar, baaki A-Z
  options.sort((a, b) => (salonCounts[b] ?? 0) - (salonCounts[a] ?? 0) || a.localeCompare(b))

  return (
    <Autocomplete
      freeSolo={freeSolo}
      autoHighlight
      disabled={disabled}
      size={size}
      options={options}
      value={value || null}
      onChange={(_, next) => onChange(next ?? '')}
      onInputChange={freeSolo ? (_, text, reason) => reason === 'input' && onChange(text) : undefined}
      renderOption={(props, option) => {
        const { key, ...rest } = props
        return (
          <li key={key} {...rest}>
            {option}
            {salonCounts[option] ? <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: '0.8rem' }}>{salonCounts[option]} salons</span> : null}
          </li>
        )
      }}
      renderInput={(params) => <TextField {...params} size="small" label={label} placeholder={placeholder ?? 'Type your city'} error={error} helperText={helperText} onBlur={onBlur} />}
    />
  )
}
