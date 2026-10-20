import { Fragment, useState } from 'react'

import { outboxApi } from '../../api/endpoints'
import type { OutboxStatus } from '../../api/types'
import { ErrorMessage, Pager, StatusBadge } from '../../components/ui'
import { formatDate } from '../../format'
import { usePaged } from '../../usePaged'

const STATUSES: (OutboxStatus | '')[] = ['', 'PENDING', 'PUBLISHED', 'FAILED']

export function OutboxPage() {
  const [status, setStatus] = useState<OutboxStatus | ''>('')
  const { data, error, loading, setPage, reload } = usePaged(
    (page, size) => outboxApi.list(status, page, size),
    [status],
  )
  const [openId, setOpenId] = useState<number | null>(null)
  const [retrying, setRetrying] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const retry = async (id: number) => {
    setRetrying(id)
    setActionError(null)
    try {
      await outboxApi.retry(id)
      reload()
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setRetrying(null)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Outbox</h1>
          <p className="muted">Events waiting for, or already sent to, Kafka.</p>
        </div>
        <div className="inline-form">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as OutboxStatus | '')}
            aria-label="Status"
            data-testid="outbox-status-filter"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s || 'All statuses'}
              </option>
            ))}
          </select>
          <button onClick={reload} data-testid="outbox-refresh">
            Refresh
          </button>
        </div>
      </div>
      <ErrorMessage error={actionError} testId="outbox-action-error" />
      <ErrorMessage error={error} testId="outbox-error" />
      {loading && !data && (
        <p className="muted" data-testid="outbox-loading">
          Loading…
        </p>
      )}
      {data?.content.length === 0 && (
        <p className="muted" data-testid="outbox-empty">
          No events.
        </p>
      )}
      {data && data.content.length > 0 && (
        <div className="table-wrap">
          <table className={loading ? 'is-loading' : undefined} data-testid="outbox-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Created</th>
                <th>Event</th>
                <th>Aggregate</th>
                <th>Status</th>
                <th>Attempts</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.content.map((event) => (
                <Fragment key={event.id}>
                  <tr
                    className="clickable"
                    onClick={() => setOpenId(openId === event.id ? null : event.id)}
                    aria-expanded={openId === event.id}
                    data-testid={`outbox-table-row-${event.id}`}
                  >
                    <td>{event.id}</td>
                    <td>{formatDate(event.createdAt)}</td>
                    <td className="mono">{event.eventType}</td>
                    <td>
                      {event.aggregateType} #{event.aggregateId}
                    </td>
                    <td>
                      <StatusBadge status={event.status} testId="outbox-event-status" />
                    </td>
                    <td className="num">{event.attempts}</td>
                    <td>
                      {event.status === 'FAILED' && (
                        <button
                          disabled={retrying === event.id}
                          data-testid="outbox-retry"
                          onClick={(e) => {
                            e.stopPropagation()
                            retry(event.id)
                          }}
                        >
                          {retrying === event.id ? 'Retrying…' : 'Retry'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {openId === event.id && (
                    <tr className="detail-row" data-testid={`outbox-table-detail-${event.id}`}>
                      <td colSpan={7}>
                        <div className="muted small">
                          Published: {formatDate(event.publishedAt)}
                          {event.lastError && <> · Last error: {event.lastError}</>}
                        </div>
                        <pre data-testid="outbox-event-payload">{JSON.stringify(event.payload, null, 2)}</pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager data={data} onPage={setPage} testId="outbox-pager" />
    </>
  )
}
