import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react'

import { rememberRecentAccounts } from '../../accounts'
import { journalApi, postingApi } from '../../api/endpoints'
import { JOURNAL_ENTRY_TYPES, type JournalEntry, type JournalEntryType } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import {
  initialPostingDrafts,
  PostingsEditor,
  toPostingRequests,
  type PostingDraft,
} from '../../components/PostingsEditor'
import { ErrorMessage, Pager } from '../../components/ui'
import { formatDate, formatMoney } from '../../format'
import { usePaged } from '../../usePaged'

interface ReferenceQuery {
  type: string
  id: number
}

export function JournalPage() {
  const { data, error, loading, setPage, reload } = usePaged((page, size) => journalApi.list(page, size), [])
  const [creating, setCreating] = useState(false)
  const [reference, setReference] = useState<ReferenceQuery | null>(null)

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Journal</h1>
          <p className="muted">Every money movement, newest first. Select an entry to see its postings.</p>
        </div>
        {!creating && (
          <button className="primary" onClick={() => setCreating(true)}>
            New entry
          </button>
        )}
      </div>

      {creating && (
        <NewEntryForm
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            setReference(null)
            setPage(0)
            reload()
          }}
        />
      )}

      <ReferenceSearch active={reference} onSearch={setReference} />

      {reference ? (
        <ReferenceResults query={reference} />
      ) : (
        <>
          <ErrorMessage error={error} />
          {loading && !data && <p className="muted">Loading…</p>}
          {data?.content.length === 0 && <p className="muted">No journal entries yet.</p>}
          {data && data.content.length > 0 && <EntriesTable entries={data.content} loading={loading} />}
          <Pager data={data} onPage={setPage} />
        </>
      )}
    </>
  )
}

function ReferenceSearch({
  active,
  onSearch,
}: {
  active: ReferenceQuery | null
  onSearch: (query: ReferenceQuery | null) => void
}) {
  const [type, setType] = useState('')
  const [id, setId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const referenceId = Number(id)
    if (!type.trim() || !Number.isSafeInteger(referenceId) || referenceId <= 0) {
      setError('Enter a reference type (e.g. transfer) and a number')
      return
    }
    setError(null)
    onSearch({ type: type.trim(), id: referenceId })
  }

  const clear = () => {
    setType('')
    setId('')
    setError(null)
    onSearch(null)
  }

  return (
    <form className="inline-form action-form" onSubmit={submit}>
      <input
        placeholder="Reference type, e.g. transfer"
        value={type}
        onChange={(e) => setType(e.target.value)}
        maxLength={50}
        aria-label="Reference type"
      />
      <input
        inputMode="numeric"
        placeholder="Reference #"
        value={id}
        onChange={(e) => setId(e.target.value)}
        aria-label="Reference number"
      />
      <button type="submit">Find</button>
      {active && (
        <button type="button" className="link" onClick={clear}>
          Show all entries
        </button>
      )}
      <ErrorMessage error={error} />
    </form>
  )
}

function ReferenceResults({ query }: { query: ReferenceQuery }) {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setEntries(null)
    setError(null)
    journalApi
      .byReference(query.type, query.id)
      .then((result) => !cancelled && setEntries(result))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [query])

  if (error) return <ErrorMessage error={error} />
  if (!entries) return <p className="muted">Loading…</p>
  if (entries.length === 0) {
    return (
      <p className="muted">
        No entries for {query.type} #{query.id}.
      </p>
    )
  }
  return <EntriesTable entries={entries} loading={false} />
}

function EntriesTable({ entries, loading }: { entries: JournalEntry[]; loading: boolean }) {
  const [openId, setOpenId] = useState<number | null>(null)

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
  const [adding, setAdding] = useState(false)

  const load = useCallback(() => {
    setError(null)
    journalApi
      .get(id)
      .then(setEntry)
      .catch((e: Error) => setError(e.message))
  }, [id])

  useEffect(load, [load])

  if (error) return <ErrorMessage error={error} />
  if (!entry) return <span className="muted">Loading…</span>

  return (
    <>
      {entry.postings?.map((p) => (
        <div key={p.id} className="posting-line">
          <span>Account #{p.accountId}</span>
          <span>{p.direction}</span>
          <span className={`num ${p.direction === 'DEBIT' ? 'neg' : 'pos'}`}>{formatMoney(p.amount, p.currency)}</span>
        </div>
      ))}
      {!entry.postings?.length && <span className="muted">No postings.</span>}
      {adding ? (
        <AddPostingsForm
          entryId={id}
          onCancel={() => setAdding(false)}
          onAdded={() => {
            setAdding(false)
            load()
          }}
        />
      ) : (
        <p>
          <button onClick={() => setAdding(true)}>Add postings</button>
        </p>
      )}
    </>
  )
}

function AddPostingsForm({ entryId, onCancel, onAdded }: { entryId: number; onCancel: () => void; onAdded: () => void }) {
  const { user } = useAuth()
  const [drafts, setDrafts] = useState<PostingDraft[]>(initialPostingDrafts)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const postings = toPostingRequests(drafts)
    if (typeof postings === 'string') {
      setError(postings)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await postingApi.addToEntry(entryId, postings)
      if (user) rememberRecentAccounts(user.id, postings.map((p) => p.accountId))
      onAdded()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="stacked-form" onSubmit={submit}>
      <span className="muted small">New postings must balance among themselves.</span>
      <PostingsEditor drafts={drafts} onChange={setDrafts} />
      <ErrorMessage error={error} />
      <div className="inline-form">
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add postings'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function NewEntryForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const { user } = useAuth()
  const [entryType, setEntryType] = useState<JournalEntryType>('TRANSFER')
  const [description, setDescription] = useState('')
  const [referenceType, setReferenceType] = useState('')
  const [referenceId, setReferenceId] = useState('')
  const [drafts, setDrafts] = useState<PostingDraft[]>(initialPostingDrafts)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const postings = toPostingRequests(drafts)
    if (typeof postings === 'string') {
      setError(postings)
      return
    }
    let refId: number | undefined
    if (referenceId.trim()) {
      refId = Number(referenceId)
      if (!Number.isSafeInteger(refId) || refId <= 0) {
        setError('The reference number must be a positive whole number')
        return
      }
    }
    setSubmitting(true)
    setError(null)
    try {
      await journalApi.create({
        entryType,
        description: description.trim() || undefined,
        referenceType: referenceType.trim() || undefined,
        referenceId: refId,
        postings,
      })
      if (user) rememberRecentAccounts(user.id, postings.map((p) => p.accountId))
      onCreated()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card stacked-form journal-form" onSubmit={submit}>
      <h2>New journal entry</h2>
      <div className="form-row">
        <label>
          Type
          <select value={entryType} onChange={(e) => setEntryType(e.target.value as JournalEntryType)}>
            {JOURNAL_ENTRY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Reference type <span className="hint">optional</span>
          <input
            placeholder="e.g. transfer"
            value={referenceType}
            onChange={(e) => setReferenceType(e.target.value)}
            maxLength={50}
          />
        </label>
        <label>
          Reference # <span className="hint">optional</span>
          <input inputMode="numeric" value={referenceId} onChange={(e) => setReferenceId(e.target.value)} />
        </label>
      </div>
      <label>
        Description <span className="hint">optional</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={255} />
      </label>
      <div>
        <div className="label">Postings</div>
        <PostingsEditor drafts={drafts} onChange={setDrafts} />
      </div>
      <ErrorMessage error={error} />
      <div className="inline-form">
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Create entry'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
