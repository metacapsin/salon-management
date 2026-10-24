// Naam ke pehle akshar ka gola ("Priya Sharma" -> "PS"). Props: name, size ('sm' ya 'md'), tone ('gold' ya 'beige').
function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

export default function Avatar({ name, size = 'md', tone = 'beige' }) {
  return (
    <span className={`gl-avatar gl-avatar--${size} gl-avatar--${tone}`} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
