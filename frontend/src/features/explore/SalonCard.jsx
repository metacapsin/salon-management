import PhotoSlider from './PhotoSlider'
import { photosOf } from './salonPhotos'

const AUDIENCE_LABEL = { women: 'Women', men: 'Men', unisex: 'Unisex' }
const MAX_TAGS = 3

// Ek salon ka card: photo, naam, rating + asli review count, doori, services, kam se kam price, aur do buttons.
// "View Details" popup kholta hai (services, map, owner); "Book Now" seedha booking page par le jaata hai. Dono me login chahiye.
export default function SalonCard({ salon, onOpen, onBook }) {
  const { average, count } = salon.rating
  const extraTags = salon.tags.length - MAX_TAGS

  return (
    <article className="ex-card">
      <div className="ex-card__media">
        <PhotoSlider
          images={photosOf(salon)}
          fallback={
            <div className="ex-card__placeholder" aria-hidden="true">
              {salon.name.charAt(0)}
            </div>
          }
        />
        {salon.offer && <span className="ex-card__offer">🏷️ {salon.offer.text}</span>}
        <span className="ex-card__aud">{AUDIENCE_LABEL[salon.audience]}</span>
      </div>

      <div className="ex-card__body">
        <div className="ex-card__top">
          <h3 className="ex-card__title">
            {/* Poora card clickable hai (CSS se), par keyboard/screen-reader ke liye asli button yahi hai */}
            <button type="button" className="ex-card__open" onClick={() => onOpen(salon)}>
              {salon.name}
            </button>
          </h3>
          {count > 0 ? (
            <span className="ex-card__rating" aria-label={`Rated ${average} out of 5 by ${count} people`}>
              {average.toFixed(1)} ★
            </span>
          ) : (
            <span className="ex-card__new">New</span>
          )}
        </div>

        <p className="ex-card__meta">
          {[salon.area, salon.distanceKm !== null && `${salon.distanceKm} km away`].filter(Boolean).join(' · ')}
          {count > 0 && <span className="ex-card__count"> · {count} {count === 1 ? 'review' : 'reviews'}</span>}
        </p>

        {salon.tags.length > 0 && (
          <ul className="ex-card__services" aria-label="Services">
            {salon.tags.slice(0, MAX_TAGS).map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
            {extraTags > 0 && <li className="ex-card__more">+{extraTags} more</li>}
          </ul>
        )}

        <div className="ex-card__chips">
          {salon.serviceModes.salonVisit && <span className="ex-chip">🏪 At salon</span>}
          {salon.serviceModes.homeService && <span className="ex-chip ex-chip--gold">🏠 Home service</span>}
        </div>

        {salon.offer && (
          <p className="ex-card__offer-line">
            {salon.offer.title}
            {salon.offer.count > 1 ? ` + ${salon.offer.count - 1} more offer${salon.offer.count > 2 ? 's' : ''}` : ''} · till {new Date(`${salon.offer.endsOn}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </p>
        )}

        <div className="ex-card__foot">
          {salon.startingPrice !== null ? (
            <span className="ex-card__price">
              From <strong>₹{salon.startingPrice}</strong>
            </span>
          ) : (
            <span />
          )}
          <span className="ex-card__actions">
            <button type="button" className="ex-card__btn" onClick={() => onOpen(salon)}>
              View Details
            </button>
            <button type="button" className="ex-card__btn ex-card__btn--primary" onClick={() => onBook(salon)}>
              Book Now
            </button>
          </span>
        </div>
      </div>
    </article>
  )
}
