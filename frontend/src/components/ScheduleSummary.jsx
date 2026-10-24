// "In service" -> "in-service" (CSS class naam banane ke liye)
const toKey = (status) => status.toLowerCase().replace(/\s+/g, '-')

// Aaj ka schedule ek patti me: har status ka hissa aur uske neeche ginti.
// Patti ki lambai = us status ke appointments / kul appointments (flex-grow se).
export default function ScheduleSummary({ data }) {
  const total = data.reduce((sum, item) => sum + item.count, 0)

  return (
    <div>
      <p className="gl-summary__total">
        {total} <span>appointments today</span>
      </p>
      <div className="gl-summary__bar" role="img" aria-label={data.map((d) => `${d.count} ${d.status}`).join(', ')}>
        {data.map((item) => (
          <span key={item.status} className={`gl-seg gl-seg--${toKey(item.status)}`} style={{ flexGrow: item.count }} />
        ))}
      </div>
      <ul className="gl-summary__legend">
        {data.map((item) => (
          <li key={item.status}>
            <span className={`gl-summary__dot gl-seg--${toKey(item.status)}`} aria-hidden="true" />
            {item.status}
            <strong>{item.count}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
