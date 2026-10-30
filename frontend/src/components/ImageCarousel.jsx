import { useCallback, useEffect, useState } from 'react'
import '../styles/carousel.css'

// Reusable photo slider: apne-aap badalta hai, Previous/Next buttons aur neeche dots hain, aakhri ke baad wapas pehli par.
// images = [{ src, alt }]. `className="ic--fill"` dene par parent (position: relative) ka poora hissa bharta hai (hero me aise),
// warna 16:9 ka apna box banata hai. Photos kabhi kheenchti/bigadti nahi. fit="cover" (default) me crop hoti hain;
// fit="contain" me poori photo dikhti hai aur khali jagah usi photo ke blur se bharti hai.
// Saari photos eager load hoti hain (chhupi slides par lazy load nahi chalta), taaki slide aate hi dikhe aur flicker na ho.
// Mouse upar ho ya keyboard focus andar ho to auto-play ruk jata hai. Timer har slide par naya banta hai aur unmount par saaf hota hai.
export default function ImageCarousel({ images, interval = 3500, className = '', label = 'Photo gallery', fit = 'cover' }) {
  const count = images.length
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const go = useCallback((step) => setIndex((i) => (i + step + count) % count), [count])

  useEffect(() => {
    if (count < 2 || paused) return undefined
    const timer = setTimeout(() => go(1), interval)
    return () => clearTimeout(timer)
  }, [index, paused, count, interval, go])

  if (count === 0) return null

  // Sirf active aur uske dono padosi slide dikhte hain; baaki chhupe rehte hain, taaki loop me photo screen ke beech se na guzre.
  const place = (i) => {
    const d = (i - index + count) % count
    if (d === 0) return { x: 0, visible: true }
    if (d === 1) return { x: 100, visible: true }
    if (d === count - 1) return { x: -100, visible: true }
    return { x: d <= count / 2 ? 100 : -100, visible: false }
  }

  return (
    <div
      className={`ic ${className}`}
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {images.map((image, i) => {
        const { x, visible } = place(i)
        return (
          <div
            key={image.src}
            className={`ic__slide${visible ? '' : ' ic__slide--off'}`}
            style={{ transform: `translateX(${x}%)` }}
            aria-hidden={i !== index}
          >
            {fit === 'contain' && <img className="ic__backdrop" src={image.src} alt="" aria-hidden="true" draggable="false" />}
            <img
              className={fit === 'contain' ? 'ic__img--contain' : undefined}
              src={image.src}
              alt={image.alt ?? ''}
              loading="eager"
              fetchPriority={i === 0 ? 'high' : 'low'}
              decoding="async"
              draggable="false"
            />
          </div>
        )
      })}

      {count > 1 && (
        <div className="ic__bar">
          <button type="button" className="ic__arrow" aria-label="Previous photo" onClick={() => go(-1)}>
            ‹
          </button>
          <div className="ic__dots">
            {images.map((image, i) => (
              <button
                key={image.src}
                type="button"
                className={`ic__dot${i === index ? ' is-on' : ''}`}
                aria-label={`Show photo ${i + 1} of ${count}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          <button type="button" className="ic__arrow" aria-label="Next photo" onClick={() => go(1)}>
            ›
          </button>
        </div>
      )}
    </div>
  )
}
