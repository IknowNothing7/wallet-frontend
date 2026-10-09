import type { ReactNode } from 'react'

import type { PageResponse } from '../api/types'

export function ErrorMessage({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p className="error" role="alert">
      {error}
    </p>
  )
}

const STATUS_TONE: Record<string, string> = {
  ACTIVE: 'good',
  COMPLETED: 'good',
  SUCCEEDED: 'good',
  PUBLISHED: 'good',
  CAPTURED: 'good',
  PENDING: 'warn',
  FAILED: 'bad',
  EXPIRED: 'muted',
  RELEASED: 'muted',
  REVERSED: 'muted',
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${STATUS_TONE[status] ?? 'muted'}`}>{status}</span>
}

export function Pager({ data, onPage }: { data: PageResponse<unknown> | null; onPage: (page: number) => void }) {
  if (!data || data.totalPages <= 1) return null
  return (
    <div className="pager">
      <button disabled={data.page === 0} onClick={() => onPage(data.page - 1)}>
        ← Newer
      </button>
      <span>
        Page {data.page + 1} of {data.totalPages}
      </span>
      <button disabled={data.page + 1 >= data.totalPages} onClick={() => onPage(data.page + 1)}>
        Older →
      </button>
    </div>
  )
}

/** Table with loading / error / empty states for one page of results. */
export function DataTable<T>({
  columns,
  rows,
  loading,
  error,
  empty,
  rowKey,
  renderRow,
}: {
  columns: string[]
  rows: T[] | undefined
  loading: boolean
  error: string | null
  empty: string
  rowKey: (row: T) => string | number
  renderRow: (row: T) => ReactNode
}) {
  if (error) return <ErrorMessage error={error} />
  if (loading && !rows) return <p className="muted">Loading…</p>
  if (!rows || rows.length === 0) return <p className="muted">{empty}</p>
  return (
    <div className="table-wrap">
      <table className={loading ? 'is-loading' : undefined}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>{renderRow(row)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
