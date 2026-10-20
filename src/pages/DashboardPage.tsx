import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { forgetMyAccounts } from '../accounts'
import { accountApi } from '../api/endpoints'
import type { Account } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { ErrorMessage, StatusBadge } from '../components/ui'
import { CURRENCIES, TRANSFER_CURRENCIES } from '../currencies'
import { formatMoney } from '../format'

export function DashboardPage() {
  const { isAdmin } = useAuth()
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currency, setCurrency] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    accountApi
      .mine()
      .then(setAccounts)
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(load, [load])

  // One account per currency, so only the ones the user doesn't have yet are offered
  const owned = new Set(accounts?.map((a) => a.currency))
  const available = CURRENCIES.filter((c) => !owned.has(c))
  const selected = available.includes(currency) ? currency : (available[0] ?? '')

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setCreating(true)
    setCreateError(null)
    try {
      const account = await accountApi.create(selected)
      forgetMyAccounts()
      setAccounts((list) => [...(list ?? []), account])
    } catch (err) {
      setCreateError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Your accounts</h1>
        {accounts && available.length > 0 && (
          <form className="inline-form" onSubmit={create} data-testid="open-account-form">
            <select
              value={selected}
              onChange={(e) => setCurrency(e.target.value)}
              aria-label="Currency"
              data-testid="open-account-currency"
            >
              {available.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button type="submit" className="primary" disabled={creating} data-testid="open-account-submit">
              {creating ? 'Opening…' : 'Open account'}
            </button>
          </form>
        )}
      </div>
      <ErrorMessage error={createError} testId="open-account-error" />
      <ErrorMessage error={error} testId="accounts-error" />

      {accounts === null && !error && (
        <p className="muted" data-testid="accounts-loading">
          Loading…
        </p>
      )}
      {accounts?.length === 0 && (
        <p className="muted" data-testid="accounts-empty">
          You don't have any accounts yet. Open one above.
        </p>
      )}

      <div className="cards" data-testid="account-cards">
        {accounts?.map((account) => (
          <Link
            key={account.id}
            to={`/accounts/${account.id}`}
            className="card account-card"
            data-testid={`account-card-${account.id}`}
          >
            <div className="card-top">
              <span className="muted">Account #{account.id}</span>
              <StatusBadge status={account.status} testId="account-card-status" />
            </div>
            <div className="balance" data-testid="account-card-balance">{formatMoney(account.balance, account.currency)}</div>
            <div className="muted" data-testid="account-card-currency">
              {account.currency}
              {!TRANSFER_CURRENCIES.includes(account.currency) && ' · deposits only'}
            </div>
          </Link>
        ))}
      </div>

      {isAdmin && <AccountLookup />}
    </>
  )
}

// Admins can open any user's account by its number
function AccountLookup() {
  const navigate = useNavigate()
  const [id, setId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const accountId = Number(id.trim().replace(/^#/, ''))
    if (!Number.isSafeInteger(accountId) || accountId <= 0) {
      setError('Enter an account number')
      return
    }
    navigate(`/accounts/${accountId}`)
  }

  return (
    <>
      <h2>Look up an account</h2>
      <form className="inline-form" onSubmit={submit} data-testid="account-lookup-form">
        <input
          inputMode="numeric"
          placeholder="Account #"
          value={id}
          onChange={(e) => setId(e.target.value)}
          aria-label="Account number"
          data-testid="account-lookup-input"
        />
        <button type="submit" data-testid="account-lookup-submit">
          Open
        </button>
        <ErrorMessage error={error} testId="account-lookup-error" />
      </form>
    </>
  )
}
