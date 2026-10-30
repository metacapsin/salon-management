import { useEffect, useState } from 'react'

const AUTO_MS = 4000

// Salon ki photos: poori photo dikhti hai (kategi nahi), khali jagah usi photo ke blur se bharti hai.
// Photo ek hi ho to bas wahi rehti hai; zyada ho to apne-aap fade ke saath badalti hain (hover par ruk jati hain),
// arrows + dots se haath se bhi badal sakte hain. Parent ko position: relative chahiye. Koi photo na ho / load na ho to `fallback`.
// Arrows card ke "poore card clickable" overlay ke upar rehte hain aur click popup nahi kholta.
export default function PhotoSlider({ images, alt = '', fallback = null }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [failed, setFailed] = useState(() => new Set())
  const slides = images.filter((url) => !failed.has(url))
  const count = slides.length

  useEffect(() => {
    if (count < 2 || paused) return undefined
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), AUTO_MS)
    return () => clearInterval(timer)
  }, [count, paused, index])

  if (count === 0) return fallback

  const current = slides[Math.min(index, count - 1)]
  const at = slides.indexOf(current)
  const go = (step) => (event) => {
    event.stopPropagation()
    setIndex((at + step + count) % count)
  }

  return (
    <div className="ex-slider" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <img key={`bg-${current}`} className="ex-slider__bg" src={current} alt="" aria-hidden="true" />
      <img key={current} className="ex-slider__img" src={current} alt={alt} loading="lazy" onError={() => setFailed((prev) => new Set(prev).add(current))} />
      {slides.length > 1 && (
        <>
          <button type="button" className="ex-slider__arrow ex-slider__arrow--prev" aria-label="Previous photo" onClick={go(-1)}>
            ‹
          </button>
          <button type="button" className="ex-slider__arrow ex-slider__arrow--next" aria-label="Next photo" onClick={go(1)}>
            ›
          </button>
          <div className="ex-slider__dots" aria-hidden="true">
            {slides.map((url, i) => (
              <span key={url} className={i === at ? 'is-on' : ''} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
