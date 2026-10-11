import { useState, type FormEvent } from 'react'

import { rememberRecentAccounts } from '../../accounts'
import { holdApi } from '../../api/endpoints'
import type { Hold } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { AccountPicker } from '../../components/AccountPicker'
import { CURRENCIES } from '../../currencies'
import { DataTable, ErrorMessage, StatusBadge } from '../../components/ui'
import { formatDate, formatMoney, toMinorUnits } from '../../format'

const DEFAULT_HOLD_DAYS = 7

// <input type="datetime-local"> works in local time without a zone: "2026-10-18T14:30"
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function HoldsPage() {
  const { user } = useAuth()
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [expiresAt, setExpiresAt] = useState(() =>
    toLocalInput(new Date(Date.now() + DEFAULT_HOLD_DAYS * 24 * 60 * 60 * 1000)),
  )
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // The backend only shows a hold to the account's owner and admins, so a merchant can't list holds;
  // this keeps the ones placed in this session from the create responses
  const [placed, setPlaced] = useState<Hold[]>([])

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
    setSubmitting(true)
    setError(null)
    try {
      const hold = await holdApi.create(id, minor, currency, expires.toISOString())
      setPlaced((list) => [hold, ...list])
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
    <>
      <h1>Holds</h1>
      <p className="muted">
        Reserve funds on a customer's account, for example at checkout. The currency must match the customer's
        account.
      </p>

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
            Currency
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Expires
          <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </label>
        <ErrorMessage error={error} />
        <div>
          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? 'Placing…' : 'Place hold'}
          </button>
        </div>
      </form>

      <h2>Placed this session</h2>
      <DataTable
        columns={['#', 'Account', 'Amount', 'Status', 'Expires']}
        rows={placed}
        loading={false}
        error={null}
        empty="No holds placed yet."
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
          </>
        )}
      />
    </>
  )
}
