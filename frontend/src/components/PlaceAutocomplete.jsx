import { useEffect, useMemo, useState } from 'react'
import { Autocomplete, CircularProgress, TextField } from '@mui/material'
import { searchPlaces } from '../api/publicApi'
import { INDIAN_CITIES } from '../data/indianCities'

// Poore India ka shehar/kasba/gaon dhundhne wala box (customer ke liye).
// Pehle turant: jin shehron me salon hain + bade shehron ki list. Phir type karte hi (300 ms ruk kar) poore India me search
// (OpenStreetMap). Suggestion me na ho to bhi jo likha hai wahi Enter dabakar chun sakte hain.
//   value: abhi ka shehar (string)   onSelect({ city, lat?, lng? })
//   salonCities: [{ city, salonCount }] (jin shehron me Galora ke salon hain)
export default function PlaceAutocomplete({ value, salonCities, onSelect, size = 'small' }) {
  const [input, setInput] = useState(value ?? '')
  const [remote, setRemote] = useState([])
  const [loading, setLoading] = useState(false)

  // Bahar se shehar badle (jaise location se) to box ka likha hua bhi badle
  useEffect(() => setInput(value ?? ''), [value])

  const local = useMemo(() => {
    const known = new Set(salonCities.map((c) => c.city.toLowerCase()))
    const listed = [
      ...salonCities.map((c) => ({ city: c.city, label: c.city, sub: `${c.salonCount} ${c.salonCount === 1 ? 'salon' : 'salons'}`, group: 'Cities with salons' })),
      ...INDIAN_CITIES.filter((c) => !known.has(c.city.toLowerCase())).map((c) => ({ city: c.city, label: c.city, sub: c.state, group: 'Popular cities' })),
    ]
    return { listed }
  }, [salonCities])

  // Type karne par poore India me search
  useEffect(() => {
    const q = input.trim()
    if (q.length < 3 || q.toLowerCase() === (value ?? '').toLowerCase()) {
      setRemote([])
      return undefined
    }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      searchPlaces(q)
        .then((places) => !cancelled && setRemote(places.map((p) => ({ city: p.name, label: p.name, sub: [p.district, p.state].filter(Boolean).join(', '), group: 'All India', lat: p.lat, lng: p.lng }))))
        .catch(() => !cancelled && setRemote([]))
        .finally(() => !cancelled && setLoading(false))
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [input, value])

  const options = useMemo(() => {
    const q = input.trim().toLowerCase()
    const matchLocal = q ? local.listed.filter((o) => o.label.toLowerCase().includes(q)) : local.listed
    const seen = new Set(matchLocal.map((o) => o.label.toLowerCase()))
    // Search se mila wahi naam jo list me pehle se hai to dobara nahi
    return [...matchLocal, ...remote.filter((o) => !seen.has(o.label.toLowerCase()) || o.sub)].filter((o, i, all) => all.findIndex((x) => x.label === o.label && x.sub === o.sub) === i)
  }, [input, local, remote])

  return (
    <Autocomplete
      freeSolo
      autoHighlight
      size={size}
      options={options}
      groupBy={(o) => o.group}
      filterOptions={(all) => all} // chhaantna upar options me ho chuka hai
      getOptionLabel={(o) => (typeof o === 'string' ? o : o.label)}
      inputValue={input}
      onInputChange={(_, text) => setInput(text)}
      onChange={(_, option) => {
        if (!option) return
        // Enter dabane par jo type kiya wahi (list me na ho to bhi)
        if (typeof option === 'string') onSelect({ city: option.trim() })
        else onSelect({ city: option.city, lat: option.lat, lng: option.lng })
      }}
      loading={loading}
      noOptionsText="Press Enter to search this place"
      renderOption={(props, option) => {
        const { key: _key, ...rest } = props
        return (
          <li key={`${option.group}-${option.label}-${option.sub}`} {...rest}>
            {option.label}
            <span style={{ marginLeft: 'auto', paddingLeft: 12, opacity: 0.6, fontSize: '0.8rem' }}>{option.sub}</span>
          </li>
        )
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="City, town or village"
          placeholder="Type any place in India"
          // MUI 9 me ye params.slotProps.input me aate hain (purane InputProps nahi)
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps?.input,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={16} /> : null}
                  {params.slotProps?.input?.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  )
}
