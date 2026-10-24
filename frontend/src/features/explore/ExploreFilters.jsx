import { useState } from 'react'
import { Drawer, useMediaQuery } from '@mui/material'
import { PRICE_BANDS, RATINGS } from './filterOptions'

const MODES = [
  { value: '', label: 'All' },
  { value: 'salon', label: '🏪 Visit salon' },
  { value: 'home', label: '🏠 Home service' },
]
const SORTS = [
  { value: 'rating', label: 'Highest rated' },
  { value: 'nearest', label: 'Nearest' },
  { value: 'price', label: 'Price: low to high' },
]

function Select({ label, value, options, onChange }) {
  return (
    <label className="ex-field ex-field--inline">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

// Rating, price aur sort: desktop par search ke saath ek line me, mobile par "Filters" drawer ke andar.
function MoreFilters({ rating, price, sort, nearMe, onChange }) {
  return (
    <>
      <Select label="Rating" value={rating} options={RATINGS} onChange={(v) => onChange({ minRating: v })} />
      <Select label="Price" value={price} options={PRICE_BANDS} onChange={(v) => onChange({ price: v })} />
      <Select label="Sort" value={sort} options={SORTS.filter((s) => s.value !== 'nearest' || nearMe)} onChange={(v) => onChange({ sort: v })} />
    </>
  )
}

// Salon ya Home service tabs, search box aur chhote filters.
export default function ExploreFilters({ mode, sort, q, nearMe, rating, price, onChange }) {
  const compact = useMediaQuery('(max-width: 720px)')
  const [open, setOpen] = useState(false)
  const activeCount = (rating ? 1 : 0) + (price ? 1 : 0)
  const clear = () => onChange({ minRating: '', price: '' })

  return (
    <div className="ex-filters">
      <div className="ex-tabs" role="tablist" aria-label="Service type">
        {MODES.map((m) => (
          <button key={m.value} type="button" role="tab" aria-selected={mode === m.value} className={mode === m.value ? 'ex-tab ex-tab--active' : 'ex-tab'} onClick={() => onChange({ mode: m.value })}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="ex-filters__row">
        <input type="search" className="ex-search" placeholder="Search salon name" aria-label="Search salon name" value={q} onChange={(e) => onChange({ q: e.target.value })} />

        {compact ? (
          <button type="button" className="ex-btn ex-filters__open" onClick={() => setOpen(true)}>
            ⚙ Filters{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
        ) : (
          <MoreFilters rating={rating} price={price} sort={sort} nearMe={nearMe} onChange={onChange} />
        )}
      </div>

      {compact && (
        <Drawer anchor="bottom" open={open} onClose={() => setOpen(false)} slotProps={{ paper: { className: 'ex-drawer' } }}>
          <div className="ex-drawer__head">
            <h3>Filters</h3>
            <button type="button" className="ex-link" onClick={clear} disabled={activeCount === 0}>
              Clear
            </button>
          </div>
          <div className="ex-drawer__body">
            <MoreFilters rating={rating} price={price} sort={sort} nearMe={nearMe} onChange={onChange} />
          </div>
          <button type="button" className="ex-card__btn ex-card__btn--primary ex-drawer__done" onClick={() => setOpen(false)}>
            Show salons
          </button>
        </Drawer>
      )}
    </div>
  )
}
