import PlaceAutocomplete from '../../components/PlaceAutocomplete'
import { samePlace } from '../../utils/geo'

// "Kahan?" wala hissa: city (type karke) + area, ya "Near me". Ye sirf dikhata hai; location dhundhne ka kaam ExplorePage karta hai
// (page khulte hi aur "Near me" dabane par, dono jagah wahi tareeka).
export default function LocationPicker({ cities, city, area, nearMe, locating, notice, error, onChange, onPlacePicked, onNearMe, onClearNearMe }) {
  const areas = cities.find((c) => samePlace(c.city, city))?.areas ?? []

  return (
    <div className="ex-location">
      <div className="ex-location__row">
        <div className="ex-field ex-field--city">
          <PlaceAutocomplete
            value={city}
            salonCities={cities}
            onSelect={({ city: next, lat, lng }) => onPlacePicked({ city: next, lat, lng })}
          />
        </div>

        <label className="ex-field">
          <span>Area</span>
          <select value={area} disabled={areas.length === 0} onChange={(e) => onChange({ area: e.target.value })}>
            <option value="">{areas.length ? `All areas in ${city}` : 'All areas'}</option>
            {areas.map((a) => (
              <option key={a.area} value={a.area}>
                {a.area} ({a.salonCount})
              </option>
            ))}
          </select>
        </label>

        <button type="button" className={nearMe ? 'ex-btn ex-btn--active' : 'ex-btn'} onClick={nearMe ? onClearNearMe : onNearMe} disabled={locating}>
          {locating ? 'Locating…' : nearMe ? '✓ Near me' : '◎ Near me'}
        </button>
      </div>
      {error && (
        <p className="ex-error" role="alert">
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="ex-notice" role="status">
          {notice}
        </p>
      )}
    </div>
  )
}
