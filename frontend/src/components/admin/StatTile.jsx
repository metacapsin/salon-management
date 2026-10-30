import { Link } from 'react-router-dom'
import Icon from '../Icon'

// Dashboard ka ek ginti wala card: icon, label, bada number aur ek line ki hint. "to" dene par poora card link ban jata he.
export default function StatTile({ icon, label, value, hint, to, tone = 'default' }) {
  const body = (
    <>
      <span className={`ad-stat__icon ad-stat__icon--${tone}`}>
        <Icon name={icon} size={20} />
      </span>
      <span className="ad-stat__label">{label}</span>
      <span className="ad-stat__value">{value}</span>
      {hint ? <span className="ad-stat__hint">{hint}</span> : null}
    </>
  )
  return to ? (
    <Link to={to} className="ad-stat ad-stat--link">
      {body}
    </Link>
  ) : (
    <div className="ad-stat">{body}</div>
  )
}
