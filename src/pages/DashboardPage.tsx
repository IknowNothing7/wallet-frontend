import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { forgetMyAccounts } from '../accounts'
import { accountApi } from '../api/endpoints'
import type { Account } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { ErrorMessage, StatusBadge } from '../components/ui'
import { CURRENCIES } from '../currencies'
import { formatMoney } from '../format'

export function DashboardPage() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currency, setCurrency] = useState('USD')
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

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    setCreating(true)
    setCreateError(null)
    try {
      const account = await accountApi.create(currency, user.id)
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
        <form className="inline-form" onSubmit={create}>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency">
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button type="submit" className="primary" disabled={creating}>
            {creating ? 'Opening…' : 'Open account'}
          </button>
        </form>
      </div>
      <ErrorMessage error={createError} />
      <ErrorMessage error={error} />

      {accounts === null && !error && <p className="muted">Loading…</p>}
      {accounts?.length === 0 && <p className="muted">You don't have any accounts yet. Open one above.</p>}

      <div className="cards">
        {accounts?.map((account) => (
          <Link key={account.id} to={`/accounts/${account.id}`} className="card account-card">
            <div className="card-top">
              <span className="muted">Account #{account.id}</span>
              <StatusBadge status={account.status} />
            </div>
            <div className="balance">{formatMoney(account.balance, account.currency)}</div>
            <div className="muted">{account.currency}</div>
          </Link>
        ))}
      </div>
    </>
  )
}
