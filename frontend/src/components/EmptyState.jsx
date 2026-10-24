import Icon from './Icon'

// Jab dikhane ko kuch na ho (khaali list, search me kuch na mile), tab ek sundar "khaali" screen.
// Props: icon, title, text, children (jaise koi button).
export default function EmptyState({ icon = 'sparkle', title, text, children }) {
  return (
    <div className="gl-empty-state">
      <span className="gl-empty-state__icon">
        <Icon name={icon} size={26} />
      </span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  )
}
