import Icon from './Icon'

// Activity ke type se icon chunte hain
const ICON_BY_TYPE = { payment: 'card', booking: 'calendar', customer: 'users', package: 'package' }

export default function ActivityList({ items }) {
  if (items.length === 0) {
    return <p className="gl-empty">No recent activity.</p>
  }

  return (
    <ul className="gl-list">
      {items.map((item) => (
        <li key={item.id} className="gl-activity">
          <span className="gl-activity__icon">
            <Icon name={ICON_BY_TYPE[item.type] ?? 'clock'} size={18} />
          </span>
          <div>
            <p className="gl-activity__text">{item.text}</p>
            <p className="gl-activity__time">{item.time}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
