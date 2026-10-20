import { Fragment, type ReactNode } from 'react'

import type { PageResponse } from '../api/types'

// Test ids are kebab-case: `<area>-<element>`, with the record id appended for repeated rows
// (`transfers-table-row-42`). Shared components take a `testId` and derive their children's ids from it.

export function ErrorMessage({ error, testId = 'error-message' }: { error: string | null; testId?: string }) {
  if (!error) return null
  return (
    <p className="error" role="alert" data-testid={testId}>
      {error}
    </p>
  )
}

export function SuccessMessage({ message, testId = 'success-message' }: { message: string | null; testId?: string }) {
  if (!message) return null
  return (
    <p className="success" role="status" data-testid={testId}>
      {message}
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
  FROZEN: 'warn',
  CLOSED: 'muted',
  ADMIN: 'bad',
  MERCHANT: 'good',
  USER: 'muted',
}

export function StatusBadge({ status, testId = 'status-badge' }: { status: string; testId?: string }) {
  return (
    <span className={`badge badge-${STATUS_TONE[status] ?? 'muted'}`} data-testid={testId}>
      {status}
    </span>
  )
}

export function Pager({
  data,
  onPage,
  testId = 'pager',
}: {
  data: PageResponse<unknown> | null
  onPage: (page: number) => void
  testId?: string
}) {
  if (!data || data.totalPages <= 1) return null
  return (
    <div className="pager" data-testid={testId}>
      <button disabled={data.page === 0} onClick={() => onPage(data.page - 1)} data-testid={`${testId}-newer`}>
        ← Newer
      </button>
      <span data-testid={`${testId}-info`}>
        Page {data.page + 1} of {data.totalPages}
      </span>
      <button
        disabled={data.page + 1 >= data.totalPages}
        onClick={() => onPage(data.page + 1)}
        data-testid={`${testId}-older`}
      >
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
  renderDetail,
  testId,
}: {
  columns: string[]
  rows: T[] | undefined
  loading: boolean
  error: string | null
  empty: string
  rowKey: (row: T) => string | number
  renderRow: (row: T) => ReactNode
  /** Optional full-width row under a row, e.g. an inline form; null for none. */
  renderDetail?: (row: T) => ReactNode | null
  /** Base for the table's test ids: `<testId>-row-<key>`, `<testId>-empty`, … */
  testId: string
}) {
  if (error) return <ErrorMessage error={error} testId={`${testId}-error`} />
  if (loading && !rows) return <p className="muted" data-testid={`${testId}-loading`}>Loading…</p>
  if (!rows || rows.length === 0) return <p className="muted" data-testid={`${testId}-empty`}>{empty}</p>
  return (
    <div className="table-wrap">
      <table className={loading ? 'is-loading' : undefined} data-testid={testId}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row)
            const detail = renderDetail?.(row)
            return (
              <Fragment key={key}>
                <tr data-testid={`${testId}-row-${key}`}>{renderRow(row)}</tr>
                {detail && (
                  <tr className="detail-row" data-testid={`${testId}-detail-${key}`}>
                    <td colSpan={columns.length}>{detail}</td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
