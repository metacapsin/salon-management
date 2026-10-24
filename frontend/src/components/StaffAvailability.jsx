import Avatar from './Avatar'
import StatusBadge from './StatusBadge'

// Staff ki list: naam, kaam aur aaj ki haalat (Available / In service / On leave).
export default function StaffAvailability({ staff }) {
  return (
    <ul className="gl-list">
      {staff.map((person) => (
        <li key={person.id} className="gl-staff">
          <Avatar name={person.name} size="sm" tone={person.status === 'On leave' ? 'beige' : 'gold'} />
          <div className="gl-staff__body">
            <p className="gl-staff__name">{person.name}</p>
            <p className="gl-staff__role">{person.role}</p>
          </div>
          <StatusBadge status={person.status} />
        </li>
      ))}
    </ul>
  )
}
