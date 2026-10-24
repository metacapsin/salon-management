import { useEffect, useRef, useState } from 'react'

// Scroll karte hue section halke se upar uthkar dikhe (fade-in). Props: children, delay (ms), className.
// IntersectionObserver = browser ka built-in jo batata hai ki koi cheez screen me aayi ya nahi.
export default function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  // Purane browser me IntersectionObserver nahi hota: wahan shuru se hi dikha do
  const [visible, setVisible] = useState(() => !('IntersectionObserver' in window))

  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    if (!('IntersectionObserver' in window)) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect() // ek baar dikh gaya, ab dekhne ki zaroorat nahi
        }
      },
      { threshold: 0.12 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={`lp-reveal ${visible ? 'is-visible' : ''} ${className}`} style={{ '--delay': `${delay}ms` }}>
      {children}
    </div>
  )
}
