import { useEffect, useRef } from 'react'
import Icon from './Icon'

// Neeche thodi der dikhne wala chhota sandesh. Props: message, onDone (5 second baad band karne ke liye).
export default function Toast({ message, onDone }) {
  // onDone ref me: parent ke dobara banne par 5 second ka timer dobara shuru na ho
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    const timer = setTimeout(() => doneRef.current(), 5000)
    return () => clearTimeout(timer)
  }, [message])

  return (
    <div className="gl-toast" role="status">
      <Icon name="check" size={18} />
      <span>{message}</span>
    </div>
  )
}
