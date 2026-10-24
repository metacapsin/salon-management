// Service category cards aur Women/Men/Unisex chips. value wahi hai jo backend ke ?category= aur ?audience= ko chahiye.
const CATEGORIES = [
  { value: 'haircut', label: 'Haircut & Styling', icon: '✂️' },
  { value: 'hair-spa', label: 'Hair Spa', icon: '💆' },
  { value: 'coloring', label: 'Hair Coloring', icon: '🎨' },
  { value: 'skincare', label: 'Facial & Skincare', icon: '✨' },
  { value: 'makeup', label: 'Makeup & Bridal', icon: '💄' },
  { value: 'nails', label: 'Nails', icon: '💅' },
  { value: 'grooming', label: 'Beard & Grooming', icon: '🧔' },
]

const AUDIENCES = [
  { value: '', label: 'All' },
  { value: 'women', label: 'Women' },
  { value: 'men', label: 'Men' },
  { value: 'unisex', label: 'Unisex' },
]

// Dobara dabane par category hat jaati hai (phir sab salons dikhte hain).
export function CategoryChips({ category, onChange }) {
  return (
    <div className="ex-cats" role="group" aria-label="Service category">
      {CATEGORIES.map((c) => {
        const active = category === c.value
        return (
          <button key={c.value} type="button" aria-pressed={active} className={active ? 'ex-cat ex-cat--active' : 'ex-cat'} onClick={() => onChange({ category: active ? '' : c.value })}>
            <span className="ex-cat__icon" aria-hidden="true">
              {c.icon}
            </span>
            <span className="ex-cat__label">{c.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function AudienceChips({ audience, onChange }) {
  return (
    <div className="ex-aud" role="group" aria-label="Salon for">
      {AUDIENCES.map((a) => (
        <button key={a.value} type="button" aria-pressed={audience === a.value} className={audience === a.value ? 'ex-aud__chip ex-aud__chip--active' : 'ex-aud__chip'} onClick={() => onChange({ audience: a.value })}>
          {a.label}
        </button>
      ))}
    </div>
  )
}
