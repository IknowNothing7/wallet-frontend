import { Fragment, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'

import { journalApi } from '../../api/endpoints'
import { REFERENCE_TYPES, type JournalEntry } from '../../api/types'
import { ErrorMessage, Pager } from '../../components/ui'
import { formatDate, formatMoney } from '../../format'
import { usePaged } from '../../usePaged'

// Read-only: the backend has no endpoint that writes to the ledger. Entries are made by transfers,
// reversals, deposits and hold captures, and corrections are new REVERSAL entries.
//
// The URL holds the current lookup, so other pages can link here:
//   ?type=transfer&id=42  entries booked for that business object
//   ?entry=7              one entry by number
export function JournalPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const entryId = positiveInt(searchParams.get('entry'))
  const refType = searchParams.get('type')
  const refId = positiveInt(searchParams.get('id'))
  const reference = refType && refId ? { type: refType, id: refId } : null

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Journal</h1>
          <p className="muted">
            Every money movement, newest first. Select an entry to see its postings. The ledger is append-only: a
            mistake is corrected by reversing the transfer.
          </p>
        </div>
      </div>

      <Lookup
        initialType={refType ?? 'transfer'}
        active={entryId !== null || reference !== null}
        onReference={(type, id) => setSearchParams({ type, id: String(id) })}
        onEntry={(id) => setSearchParams({ entry: String(id) })}
        onClear={() => setSearchParams({})}
      />

      {entryId !== null ? (
        <SingleEntry id={entryId} />
      ) : reference ? (
        <ReferenceResults type={reference.type} id={reference.id} />
      ) : (
        <AllEntries />
      )}
    </>
  )
}

function positiveInt(value: string | null): number | null {
  const n = Number(value)
  return value && Number.isSafeInteger(n) && n > 0 ? n : null
}

function Lookup({
  initialType,
  active,
  onReference,
  onEntry,
  onClear,
}: {
  initialType: string
  active: boolean
  onReference: (type: string, id: number) => void
  onEntry: (id: number) => void
  onClear: () => void
}) {
  const [type, setType] = useState(initialType)
  const [id, setId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const n = positiveInt(id.trim().replace(/^#/, ''))
    if (n === null) {
      setError('Enter a number')
      return
    }
    setError(null)
    if (type === 'entry') onEntry(n)
    else onReference(type, n)
  }

  return (
    <form className="inline-form action-form" onSubmit={submit}>
      <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Look up by">
        {REFERENCE_TYPES.map((t) => (
          <option key={t} value={t}>
            {t[0].toUpperCase() + t.slice(1)} #
          </option>
        ))}
        <option value="entry">Journal entry #</option>
      </select>
      <input inputMode="numeric" placeholder="Number" value={id} onChange={(e) => setId(e.target.value)} aria-label="Number" />
      <button type="submit">Find</button>
      {active && (
        <button type="button" className="link" onClick={onClear}>
          Show all entries
        </button>
      )}
      <ErrorMessage error={error} />
    </form>
  )
}

function AllEntries() {
  const { data, error, loading, setPage } = usePaged((page, size) => journalApi.list(page, size), [])
  return (
    <>
      <ErrorMessage error={error} />
      {loading && !data && <p className="muted">Loading…</p>}
      {data?.content.length === 0 && <p className="muted">No journal entries yet.</p>}
      {data && data.content.length > 0 && <EntriesTable entries={data.content} loading={loading} />}
      <Pager data={data} onPage={setPage} />
    </>
  )
}

function SingleEntry({ id }: { id: number }) {
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setEntry(null)
    setError(null)
    journalApi
      .get(id)
      .then((result) => !cancelled && setEntry(result))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [id])

  if (error) return <ErrorMessage error={error} />
  if (!entry) return <p className="muted">Loading…</p>
  return <EntriesTable entries={[entry]} loading={false} initiallyOpen={entry.id} />
}

function ReferenceResults({ type, id }: { type: string; id: number }) {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setEntries(null)
    setError(null)
    journalApi
      .byReference(type, id)
      .then((result) => !cancelled && setEntries(result))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [type, id])

  if (error) return <ErrorMessage error={error} />
  if (!entries) return <p className="muted">Loading…</p>
  if (entries.length === 0) {
    return (
      <p className="muted">
        No entries for {type} #{id}.
      </p>
    )
  }
  return <EntriesTable entries={entries} loading={false} initiallyOpen={entries.length === 1 ? entries[0].id : null} />
}

function EntriesTable({
  entries,
  loading,
  initiallyOpen = null,
}: {
  entries: JournalEntry[]
  loading: boolean
  initiallyOpen?: number | null
}) {
  const [openId, setOpenId] = useState<number | null>(initiallyOpen)

  return (
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
          {entries.map((entry) => (
            <Fragment key={entry.id}>
              <tr
                className="clickable"
                onClick={() => setOpenId(openId === entry.id ? null : entry.id)}
                aria-expanded={openId === entry.id}
              >
                <td>{entry.id}</td>
                <td>{formatDate(entry.createdAt)}</td>
                <td>{entry.entryType}</td>
                <td>{entry.referenceType ? `${entry.referenceType} #${entry.referenceId}` : '—'}</td>
                <td>{entry.description ?? '—'}</td>
              </tr>
              {openId === entry.id && (
                <tr className="detail-row">
                  <td colSpan={5}>
                    <EntryDetail id={entry.id} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EntryDetail({ id }: { id: number }) {
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    journalApi
      .get(id)
      .then((result) => !cancelled && setEntry(result))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [id])

  if (error) return <ErrorMessage error={error} />
  if (!entry) return <span className="muted">Loading…</span>
  if (!entry.postings?.length) return <span className="muted">No postings.</span>

  return (
    <>
      {entry.postings.map((p) => (
        <div key={p.id} className="posting-line">
          {/* System accounts (fees, bank clearing) answer as not found, even for admins */}
          <Link to={`/accounts/${p.accountId}`}>Account #{p.accountId}</Link>
          <span>{p.direction}</span>
          <span className={`num ${p.direction === 'DEBIT' ? 'neg' : 'pos'}`}>{formatMoney(p.amount, p.currency)}</span>
        </div>
      ))}
    </>
  )
}
