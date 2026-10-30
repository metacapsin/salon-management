import { Pagination } from '@mui/material'

// Table ke neeche: "Showing 1-20 of 33" aur page numbers. Ek hi page ho to sirf ginti dikhti he.
export default function TablePager({ page, total, pageSize = 20, onChange, noun = 'results' }) {
  if (!total) return null
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="ad-pager">
      <span className="ad-pager__info">
        Showing {from}–{to} of {total} {total === 1 ? noun.replace(/s$/, '') : noun}
      </span>
      {pageCount > 1 && <Pagination count={pageCount} page={page} onChange={(_, p) => onChange(p)} size="small" shape="rounded" />}
    </div>
  )
}
