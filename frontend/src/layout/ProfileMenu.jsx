import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS, roleCan } from '../auth/permissions'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import useDismiss from '../hooks/useDismiss'

// Naam wale button par click karne se khulne wala menu: profile ki jaankari, settings link aur Sign out.
export default function ProfileMenu() {
  const { user, role, activeSalon, activeSalonId, memberships, switchSalon, logout } = useAuth()
  const boxRef = useRef(null)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(boxRef, open, close)

  return (
    <div className="gl-pop" ref={boxRef}>
      <button type="button" className="gl-profilebtn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="true">
        <Avatar name={user?.name} size="md" tone="gold" />
        <span className="gl-header__who">
          <strong>{user?.name}</strong>
          <span>{ROLE_LABELS[role] ?? role}</span>
        </span>
        <Icon name="chevron" size={16} />
      </button>

      {open && (
        <div className="gl-pop__panel">
          <div className="gl-pop__head gl-pop__head--stack">
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
            <span className="gl-pill">{activeSalon?.salonName}</span>
          </div>
          <ul className="gl-menu">
            {/* Ek se zyada salon ho to yahin se badlo (naye layout me ye pehle nahi tha) */}
            {memberships.length > 1 &&
              memberships.map((m) => (
                <li key={m.salonId}>
                  <button
                    type="button"
                    aria-current={m.salonId === activeSalonId ? 'true' : undefined}
                    onClick={() => {
                      if (m.salonId !== activeSalonId) switchSalon(m.salonId)
                      close()
                    }}
                  >
                    <Icon name={m.salonId === activeSalonId ? 'check' : 'scissors'} size={18} /> {m.salonName}
                  </button>
                </li>
              ))}
            {roleCan(role, 'settings.read') && (
              <li>
                <Link to="/settings" onClick={close}>
                  <Icon name="settings" size={18} /> Salon settings
                </Link>
              </li>
            )}
            <li>
              <button type="button" onClick={logout}>
                <Icon name="logout" size={18} /> Sign out
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
