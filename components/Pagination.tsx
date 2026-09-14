'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fmtInt } from '@/lib/format'
import { Button } from './ui'

export const PAGE_SIZES = [25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZES)[number]
export const DEFAULT_PAGE_SIZE: PageSize = 50

export function Pagination({
  page, pageSize, total, onPage, onPageSize,
}: {
  page: number
  pageSize: PageSize
  total: number
  onPage: (next: number) => void
  onPageSize: (next: PageSize) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <nav
      aria-label="Lead pages"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-4 py-2.5"
    >
      <p className="text-[12.5px] text-muted" aria-live="polite">
        {total === 0 ? 'No leads to show' : (
          <>
            Showing <span className="fig text-ink">{fmtInt(first)}</span>
            {' to '}<span className="fig text-ink">{fmtInt(last)}</span>
            {' of '}<span className="fig text-ink">{fmtInt(total)}</span>
          </>
        )}
      </p>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-[12.5px] text-muted">
          <span className="hidden sm:inline">Rows</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value) as PageSize)}
            aria-label="Leads per page"
            className="rounded-lg border border-line bg-surface px-1.5 py-1 text-[12.5px] text-ink"
          >
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>

        <div className="flex items-center gap-1">
          <Button
            variant="quiet" size="sm"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          <span className="fig px-1 text-[12.5px] text-muted">
            {fmtInt(page)} / {fmtInt(pages)}
          </span>

          <Button
            variant="quiet" size="sm"
            onClick={() => onPage(page + 1)}
            disabled={page >= pages}
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </nav>
  )
}
