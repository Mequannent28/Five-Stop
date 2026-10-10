import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Pagination component
 *
 * Props:
 *   page        – current page (1-based)
 *   pageSize    – rows per page
 *   total       – total number of rows
 *   onPage      – (newPage) => void
 *   onPageSize  – (newSize) => void
 *   pageSizes   – array of size options, default [5, 10, 20, 50]
 */
export default function Pagination({
  page = 1,
  pageSize = 10,
  total = 0,
  onPage,
  onPageSize,
  pageSizes = [5, 10, 20, 50],
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  // Build page number buttons — show at most 5 around the current page
  const pages = [];
  const WINDOW = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= page - WINDOW && i <= page + WINDOW)
    ) {
      pages.push(i);
    }
  }
  // Insert ellipsis markers
  const withEllipsis = [];
  let prev = null;
  for (const p of pages) {
    if (prev !== null && p - prev > 1) withEllipsis.push('…');
    withEllipsis.push(p);
    prev = p;
  }

  const btnBase =
    'inline-flex items-center justify-center min-w-[32px] h-8 rounded-lg px-2 text-xs font-semibold transition';
  const btnActive =
    'bg-blue-600 text-white shadow-sm';
  const btnInactive =
    'border border-ink-200 bg-white text-ink-600 hover:border-blue-400 hover:text-blue-600';
  const btnDisabled =
    'border border-ink-100 bg-ink-50 text-ink-300 cursor-not-allowed';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-ink-100 bg-white rounded-b-xl">

      {/* Left: rows per page selector + count */}
      <div className="flex items-center gap-2.5 text-xs text-ink-500">
        <span>Rows per page:</span>
        <select
          value={pageSize}
          onChange={e => { onPageSize?.(Number(e.target.value)); onPage?.(1); }}
          className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 outline-none focus:border-blue-500 cursor-pointer"
        >
          {pageSizes.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-ink-400">
          {total === 0 ? 'No records' : `${from}–${to} of ${total}`}
        </span>
      </div>

      {/* Right: page navigation */}
      <div className="flex items-center gap-1">
        {/* First */}
        <button
          onClick={() => onPage?.(1)}
          disabled={page === 1}
          className={`${btnBase} ${page === 1 ? btnDisabled : btnInactive}`}
          title="First page"
        >
          <ChevronsLeft size={13} />
        </button>

        {/* Prev */}
        <button
          onClick={() => onPage?.(page - 1)}
          disabled={page === 1}
          className={`${btnBase} ${page === 1 ? btnDisabled : btnInactive}`}
          title="Previous page"
        >
          <ChevronLeft size={13} />
        </button>

        {/* Page numbers */}
        {withEllipsis.map((p, i) =>
          p === '…' ? (
            <span key={`e-${i}`} className="inline-flex items-center justify-center min-w-[32px] h-8 text-xs text-ink-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPage?.(p)}
              className={`${btnBase} ${p === page ? btnActive : btnInactive}`}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPage?.(page + 1)}
          disabled={page === totalPages}
          className={`${btnBase} ${page === totalPages ? btnDisabled : btnInactive}`}
          title="Next page"
        >
          <ChevronRight size={13} />
        </button>

        {/* Last */}
        <button
          onClick={() => onPage?.(totalPages)}
          disabled={page === totalPages}
          className={`${btnBase} ${page === totalPages ? btnDisabled : btnInactive}`}
          title="Last page"
        >
          <ChevronsRight size={13} />
        </button>
      </div>
    </div>
  );
}
