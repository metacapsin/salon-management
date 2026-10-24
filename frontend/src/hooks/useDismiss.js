import { useEffect } from 'react'

// Popup (menu/dropdown) ko band karne ka common tareeka: bahar click karo ya Escape dabao.
// Hook = ek aisa function jo "use" se shuru hota hai aur component ke andar chalta hai.
// Use: useDismiss(boxRef, isOpen, () => setOpen(false))
export default function useDismiss(ref, isOpen, onClose) {
  useEffect(() => {
    if (!isOpen) return undefined

    const onPointerDown = (event) => {
      // Click usi popup ke andar hua? To kuch mat karo
      if (ref.current && !ref.current.contains(event.target)) onClose()
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    // Cleanup: component hatne ya popup band hone par listeners hata do, warna ye jama hote rehte hain
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [ref, isOpen, onClose])
}
