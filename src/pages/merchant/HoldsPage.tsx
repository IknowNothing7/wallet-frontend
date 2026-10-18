import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { forgetMyAccounts, loadMyAccounts, rememberRecentAccounts } from '../../accounts'
import { holdApi } from '../../api/endpoints'
import type { Account, Hold } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { AccountPicker } from '../../components/AccountPicker'
import { CURRENCIES } from '../../currencies'
import { DataTable, ErrorMessage, StatusBadge } from '../../components/ui'
import { formatDate, formatMoney, toMinorUnits } from '../../format'

// The backend caps a hold at 7 days from creation
const MAX_HOLD_DAYS = 7
const DEFAULT_HOLD_DAYS = 3
const TRACKED_LIMIT = 50

// <input type="datetime-local"> works in local time without a zone: "2026-10-18T14:30"
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const days = (n: number) => n * 24 * 60 * 60 * 1000

// There is no endpoint that lists a merchant's holds, so the ids of the ones placed here are kept in this
// browser and each is re-read from GET /api/holds/{id}, which the placing merchant may call
const trackedKey = (userId: number) => `wallet.merchantHolds.${userId}`

function readTracked(userId: number): number[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(trackedKey(userId)) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isSafeInteger(id)) : []
  } catch {
    return []
  }
}

function writeTracked(userId: number, ids: number[]) {
  try {
    localStorage.setItem(trackedKey(userId), JSON.stringify(ids.slice(0, TRACKED_LIMIT)))
  } catch {
    // Storage unavailable: the list just won't survive a reload
  }
}

export function HoldsPage() {
  const { user } = useAuth()
  const [holds, setHolds] = useState<Hold[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [myAccounts, setMyAccounts] = useState<Account[]>([])

  const track = useCallback(
    (hold: Hold) => {
      if (!user) return
      writeTracked(user.id, [hold.id, ...readTracked(user.id).filter((id) => id !== hold.id)])
      setHolds((list) => [hold, ...(list ?? []).filter((h) => h.id !== hold.id)])
    },
    [user],
  )

  const replace = (hold: Hold) => setHolds((list) => list?.map((h) => (h.id === hold.id ? hold : h)) ?? null)

  const forget = (id: number) => {
    if (!user) return
    writeTracked(user.id, readTracked(user.id).filter((x) => x !== id))
    setHolds((list) => list?.filter((h) => h.id !== id) ?? null)
  }

  const load = useCallback(async () => {
    if (!user) return
    setLoadError(null)
    const ids = readTracked(user.id)
    const results = await Promise.allSettled(ids.map((id) => holdApi.get(id)))
    // Holds that can't be read are left out of the list but stay tracked, in case the error was temporary
    const failure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (failure) setLoadError(`Some holds could not be loaded: ${(failure.reason as Error).message}`)
    setHolds(results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])))
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const loadAccounts = useCallback(() => {
    if (!user) return
    loadMyAccounts(user.id)
      .then(setMyAccounts)
      .catch(() => undefined)
  }, [user])

  useEffect(loadAccounts, [loadAccounts])

  return (
    <>
      <h1>Holds</h1>
      <p className="muted">
        Reserve funds on a customer's account, for example at checkout, then capture them into one of your accounts or
        release them. Uncaptured holds expire on their own.
      </p>

      <PlaceHoldForm onPlaced={track} />

      <div className="page-header section-header">
        <h2>Your holds</h2>
        <div className="inline-form">
          <TrackHoldForm onFound={track} />
          <button onClick={load}>Refresh</button>
        </div>
      </div>
      <ErrorMessage error={loadError} />
      {holds === null ? (
        <p className="muted">Loading…</p>
      ) : (
        <DataTable
          columns={['#', 'Customer account', 'Amount', 'Status', 'Expires', '']}
          rows={holds}
          loading={false}
          error={null}
          empty="No holds placed from this browser yet."
          rowKey={(h) => h.id}
          renderRow={(h) => (
            <>
              <td>{h.id}</td>
              <td>#{h.accountId}</td>
              <td className="num">{formatMoney(h.amount, h.currency)}</td>
              <td>
                <StatusBadge status={h.status} />
              </td>
              <td>{formatDate(h.expiresAt)}</td>
              <td className="actions">
                {h.status !== 'ACTIVE' && (
                  <button className="link" onClick={() => forget(h.id)}>
                    Remove
                  </button>
                )}
              </td>
            </>
          )}
          renderDetail={(h) =>
            h.status === 'ACTIVE' ? (
              <HoldActions
                hold={h}
                accounts={myAccounts.filter((a) => a.currency === h.currency && a.status === 'ACTIVE')}
                onChanged={(updated) => {
                  replace(updated)
                  if (updated.status === 'CAPTURED') {
                    forgetMyAccounts()
                    loadAccounts()
                  }
                }}
              />
            ) : null
          }
        />
      )}
    </>
  )
}

function PlaceHoldForm({ onPlaced }: { onPlaced: (hold: Hold) => void }) {
  const { user } = useAuth()
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [expiresAt, setExpiresAt] = useState(() => toLocalInput(new Date(Date.now() + days(DEFAULT_HOLD_DAYS))))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const id = Number(accountId)
    if (!Number.isSafeInteger(id) || id <= 0) {
      setError("Enter the customer's account number")
      return
    }
    const minor = toMinorUnits(amount, currency)
    if (minor === null) {
      setError('Enter a positive amount, e.g. 25.00')
      return
    }
    const expires = new Date(expiresAt)
    if (Number.isNaN(expires.getTime()) || expires.getTime() <= Date.now()) {
      setError('The expiry must be in the future')
      return
    }
    if (expires.getTime() > Date.now() + days(MAX_HOLD_DAYS)) {
      setError(`A hold can last at most ${MAX_HOLD_DAYS} days`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const hold = await holdApi.create(id, minor, currency, expires.toISOString())
      onPlaced(hold)
      if (user) rememberRecentAccounts(user.id, [id])
      setAccountId('')
      setAmount('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card stacked-form" onSubmit={submit}>
      <label>
        Customer account #
        <AccountPicker
          value={accountId}
          onChange={setAccountId}
          includeMine={false}
          placeholder="Customer account #"
          label="Customer account number"
        />
      </label>
      <div className="form-row">
        <label>
          Amount
          <input inputMode="decimal" placeholder="25.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label>
          Currency <span className="hint">must match the customer's account</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Expires <span className="hint">at most {MAX_HOLD_DAYS} days from now</span>
        <input
          type="datetime-local"
          value={expiresAt}
          min={toLocalInput(new Date())}
          max={toLocalInput(new Date(Date.now() + days(MAX_HOLD_DAYS)))}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
      </label>
      <ErrorMessage error={error} />
      <div>
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Placing…' : 'Place hold'}
        </button>
      </div>
    </form>
  )
}

// Adds a hold placed elsewhere (another browser, an API client) to the list
function TrackHoldForm({ onFound }: { onFound: (hold: Hold) => void }) {
  const [id, setId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const holdId = Number(id.trim().replace(/^#/, ''))
    if (!Number.isSafeInteger(holdId) || holdId <= 0) {
      setError('Enter a hold number')
      return
    }
    setError(null)
    try {
      onFound(await holdApi.get(holdId))
      setId('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <input inputMode="numeric" placeholder="Hold #" value={id} onChange={(e) => setId(e.target.value)} aria-label="Hold number" />
      <button type="submit">Add</button>
      <ErrorMessage error={error} />
    </form>
  )
}

function HoldActions({
  hold,
  accounts,
  onChanged,
}: {
  hold: Hold
  accounts: Account[]
  onChanged: (hold: Hold) => void
}) {
  const [destination, setDestination] = useState('')
  const [busy, setBusy] = useState<'capture' | 'release' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = accounts.some((a) => String(a.id) === destination) ? destination : String(accounts[0]?.id ?? '')
  const expired = new Date(hold.expiresAt).getTime() <= Date.now()

  const run = async (action: 'capture' | 'release') => {
    setBusy(action)
    setError(null)
    try {
      onChanged(action === 'capture' ? await holdApi.capture(hold.id, Number(selected)) : await holdApi.release(hold.id))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (expired) return <span className="muted small">Past its expiry; it will be marked EXPIRED shortly.</span>

  return (
    <div className="inline-form">
      {accounts.length > 0 ? (
        <>
          <span>Capture into</span>
          <select value={selected} onChange={(e) => setDestination(e.target.value)} aria-label="Destination account">
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                #{a.id} · {formatMoney(a.balance, a.currency)}
              </option>
            ))}
          </select>
          <button className="primary" disabled={busy !== null} onClick={() => run('capture')}>
            {busy === 'capture' ? 'Capturing…' : 'Capture'}
          </button>
        </>
      ) : (
        <span className="muted small">Open a {hold.currency} account to capture this hold.</span>
      )}
      <button disabled={busy !== null} onClick={() => run('release')}>
        {busy === 'release' ? 'Releasing…' : 'Release'}
      </button>
      <ErrorMessage error={error} />
    </div>
  )
}
