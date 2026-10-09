import { Fragment, useState } from 'react'

import { journalApi } from '../../api/endpoints'
import type { JournalEntry } from '../../api/types'
import { ErrorMessage, Pager } from '../../components/ui'
import { formatDate, formatMoney } from '../../format'
import { usePaged } from '../../usePaged'

export function JournalPage() {
  const { data, error, loading, setPage } = usePaged((page, size) => journalApi.list(page, size), [])
  const [openId, setOpenId] = useState<number | null>(null)
  const [details, setDetails] = useState<Record<number, JournalEntry>>({})
  const [detailError, setDetailError] = useState<string | null>(null)

  const toggle = async (id: number) => {
    if (openId === id) {
      setOpenId(null)
      return
    }
    setOpenId(id)
    setDetailError(null)
    if (!details[id]) {
      try {
        const entry = await journalApi.get(id)
        setDetails((d) => ({ ...d, [id]: entry }))
      } catch (e) {
        setDetailError((e as Error).message)
      }
    }
  }

  return (
    <>
      <h1>Journal</h1>
      <p className="muted">Every money movement, newest first. Select an entry to see its postings.</p>
      <ErrorMessage error={error} />
      {loading && !data && <p className="muted">Loading…</p>}
      {data?.content.length === 0 && <p className="muted">No journal entries yet.</p>}
      {data && data.content.length > 0 && (
        <div className="table-wrap">
          <table className={loading ? 'is-loading' : undefined}>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((entry) => (
                <Fragment key={entry.id}>
                  <tr className="clickable" onClick={() => toggle(entry.id)} aria-expanded={openId === entry.id}>
                    <td>{entry.id}</td>
                    <td>{formatDate(entry.createdAt)}</td>
                    <td>{entry.entryType}</td>
                    <td>{entry.referenceType ? `${entry.referenceType} #${entry.referenceId}` : '—'}</td>
                    <td>{entry.description ?? '—'}</td>
                  </tr>
                  {openId === entry.id && (
                    <tr className="detail-row">
                      <td colSpan={5}>
                        <ErrorMessage error={detailError} />
                        {!details[entry.id] && !detailError && <span className="muted">Loading…</span>}
                        {details[entry.id]?.postings?.map((p) => (
                          <div key={p.id} className="posting-line">
                            <span>Account #{p.accountId}</span>
                            <span>{p.direction}</span>
                            <span className={`num ${p.direction === 'DEBIT' ? 'neg' : 'pos'}`}>
                              {formatMoney(p.amount, p.currency)}
                            </span>
                          </div>
                        ))}
                        {details[entry.id]?.postings?.length === 0 && <span className="muted">No postings.</span>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager data={data} onPage={setPage} />
    </>
  )
}
