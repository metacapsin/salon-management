import { useEffect, useId, useRef } from 'react'
import Icon from './Icon'

// Screen ke beech me khulne wali dialog (popup). Props: title, onClose, children (andar ka form).
// Keyboard: Escape se band. Khulte hi pehla field chuna jaata hai, band hone par focus wapas wahin jaata hai jahan se khola tha.
export default function Modal({ title, onClose, children }) {
  const titleId = useId()
  const boxRef = useRef(null)
  // onClose ko ref me rakhte hain, taaki parent har baar naya function de tab bhi neeche wala effect dobara na chale
  // (warna har keystroke par focus pehle field par laut jaata).
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const opener = document.activeElement // kisne modal khola tha (button) use yaad rakho
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden' // peeche ka page scroll na ho

    // Pehla field/button par focus
    boxRef.current?.querySelector('input, select, textarea, button:not([data-close])')?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current()
      // Tab dabane par focus modal ke andar hi ghoomta rahe
      if (event.key === 'Tab' && boxRef.current) {
        const items = boxRef.current.querySelectorAll('a[href], button:not([disabled]), input, select, textarea')
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      opener?.focus?.()
    }
  }, [])

  return (
    <div className="gl-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={boxRef} className="gl-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="gl-modal__head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="gl-iconbtn gl-iconbtn--flat" onClick={onClose} aria-label="Close" data-close>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
