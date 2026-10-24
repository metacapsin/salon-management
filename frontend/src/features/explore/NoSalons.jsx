import { useQuery } from '@tanstack/react-query'
import { nearestSalons } from '../../api/publicApi'
import { samePlace } from '../../utils/geo'
import SalonCard from './SalonCard'

// Jab list khaali ho: ya to is shehar me salon hi nahi (saaf message + sabse paas ke salon), ya filters se koi nahi mila.
// origin = customer ki location ya chuni hui jagah ke coordinates ({lat, lng}); na ho to sirf shehar ke suggestions dikhte hain.
export default function NoSalons({ city, where, cities, origin, onViewCity, onClearFilters, onOpen, onBook }) {
  const cityHasSalons = cities.some((c) => samePlace(c.city, city))

  const nearby = useQuery({
    queryKey: ['public', 'nearest', origin?.lat, origin?.lng],
    queryFn: () => nearestSalons(origin.lat, origin.lng, 9),
    enabled: !cityHasSalons && Boolean(origin),
  })

  if (cityHasSalons) {
    return (
      <div className="ex-empty">
        <p>No salons match these filters in {where}.</p>
        <button type="button" className="ex-btn" onClick={onClearFilters}>
          Clear filters
        </button>
      </div>
    )
  }

  return (
    <div className="ex-empty">
      <p className="ex-empty__title">No salons in {city} yet.</p>
      {nearby.data?.length > 0 ? (
        <>
          <p>We are adding new salons every day. Meanwhile, here are the closest salons to you:</p>
          <div className="ex-grid">
            {nearby.data.map((salon) => (
              <SalonCard key={salon.id} salon={salon} onOpen={onOpen} onBook={onBook} />
            ))}
          </div>
        </>
      ) : (
        <p>We are adding new salons every day. Please check back soon.</p>
      )}

      {!nearby.data?.length && cities.length > 0 && (
        <p className="ex-suggest">
          Try:{' '}
          {cities.slice(0, 5).map((c) => (
            <button key={c.city} type="button" className="ex-link" onClick={() => onViewCity(c.city)}>
              {c.city}
            </button>
          ))}
        </p>
      )}
    </div>
  )
}
