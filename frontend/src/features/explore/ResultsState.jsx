import { friendlyError } from '../../api/client'

// Salon list ke 4 haal: loading (skeleton cards), error (Try again ke saath), khaali, aur data.
// query = useQuery ka result; isEmpty/empty = khaali hone par kya dikhana hai.
export default function ResultsState({ query, isEmpty, empty, children }) {
  if (query.isPending) {
    return (
      <div className="ex-grid" role="status" aria-label="Loading salons">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="ex-card ex-skel" aria-hidden="true">
            <div className="ex-skel__media" />
            <div className="ex-card__body">
              <div className="ex-skel__line ex-skel__line--title" />
              <div className="ex-skel__line" />
              <div className="ex-skel__line ex-skel__line--short" />
              <div className="ex-skel__line ex-skel__line--btn" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (query.isError) {
    return (
      <div className="ex-empty ex-empty--error" role="alert">
        <span className="ex-empty__icon" aria-hidden="true">
          ⚠️
        </span>
        <p className="ex-empty__title">We could not load salons</p>
        <p>{friendlyError(query.error)}</p>
        <button type="button" className="ex-btn" onClick={() => query.refetch()}>
          Try again
        </button>
      </div>
    )
  }
  if (isEmpty) return empty
  return children
}
