import { useLayoutEffect, useRef } from 'react'
import { Table } from '@mui/material'

// MUI Table jo chhote screen par (720px se kam) har row ko card bana deta he.
// Header ka text har cell ke "data-label" me copy hota he; CSS (.gl-rtable) usi se naam dikhati he.
// Baaki sab Table jaisa hi: wahi props, wahi children.
export default function ResponsiveTable({ className, children, ...props }) {
  const ref = useRef(null)

  // Har render ke baad labels dobara bharo (rows badalti rehti hain)
  useLayoutEffect(() => {
    const table = ref.current
    if (!table) return
    const labels = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim())
    table.querySelectorAll('tbody tr').forEach((row) => {
      ;[...row.children].forEach((cell, i) => {
        if (labels[i]) cell.setAttribute('data-label', labels[i])
        else cell.removeAttribute('data-label')
      })
    })
  })

  return (
    <Table ref={ref} className={className ? `gl-rtable ${className}` : 'gl-rtable'} {...props}>
      {children}
    </Table>
  )
}
