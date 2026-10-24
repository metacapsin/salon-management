import Avatar from './Avatar'
import EmptyState from './EmptyState'
import StatusBadge from './StatusBadge'

// "2026-10-15" -> "15 Oct". 'today' -> "Today".
function dayLabel(date) {
  if (date === 'today') return 'Today'
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// Aane wali appointments ki table.
// Props: items (list), searchText (abhi kya dhoondha gaya), onClearSearch (search hatane ka function), action (khaali haal me dikhne wala button).
// Bade screen par asli <table>; chhote screen par CSS isi ko cards me badal deti hai (data-label se naam dikhta hai).
export default function AppointmentTable({ items, searchText, onClearSearch, action }) {
  if (items.length === 0) {
    return searchText ? (
      <EmptyState icon="search" title="No matching appointments" text={`Nothing matches "${searchText}". Try a customer name, service or staff member.`}>
        <button type="button" className="gl-btn gl-btn--ghost" onClick={onClearSearch}>
          Clear search
        </button>
      </EmptyState>
    ) : (
      <EmptyState icon="calendar" title="No appointments yet" text="When you book an appointment it will show up here.">
        {action}
      </EmptyState>
    )
  }

  return (
    <div className="gl-tablewrap">
      <table className="gl-table">
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Customer</th>
            <th scope="col">Service</th>
            <th scope="col">Staff</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td data-label="Time">
                <strong className="gl-time">{item.time}</strong>
                <span className="gl-table__sub">{dayLabel(item.date)}</span>
              </td>
              <td data-label="Customer">
                <span className="gl-person">
                  <Avatar name={item.customer} size="sm" />
                  <span>
                    {item.customer}
                    {item.isPreview && <span className="gl-pill">Preview</span>}
                  </span>
                </span>
              </td>
              <td data-label="Service">{item.service}</td>
              <td data-label="Staff">{item.staff}</td>
              <td data-label="Status">
                <StatusBadge status={item.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
