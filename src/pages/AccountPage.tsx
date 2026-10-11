import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'

import { rememberRecentAccounts } from '../accounts'
import { accountApi, depositApi, holdApi, postingApi, transferApi } from '../api/endpoints'
import type { Account } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { AccountPicker } from '../components/AccountPicker'
import { DataTable, ErrorMessage, Pager, StatusBadge } from '../components/ui'
import { formatDate, formatMoney, toMinorUnits } from '../format'
import { usePaged } from '../usePaged'

const TABS = ['transfers', 'deposits', 'holds', 'postings'] as const
type Tab = (typeof TABS)[number]

export function AccountPage() {
  const accountId = Number(useParams().id)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: Tab = TABS.includes(searchParams.get('tab') as Tab) ? (searchParams.get('tab') as Tab) : 'transfers'
  const [account, setAccount] = useState<Account | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setAccount(null)
    setError(null)
    accountApi
      .get(accountId)
      .then(setAccount)
      .catch((e: Error) => setError(e.message))
  }, [accountId])

  if (error) {
    return (
      <>
        <p>
          <Link to="/">← Accounts</Link>
        </p>
        <ErrorMessage error={error} />
      </>
    )
  }
  if (!account) return <p className="muted">Loading…</p>

  return (
    <>
      <p>
        <Link to="/">← Accounts</Link>
      </p>
      <div className="page-header">
        <div>
          <h1>Account #{account.id}</h1>
          <p className="muted">
            {account.currency} · opened {formatDate(account.createdAt)} · <StatusBadge status={account.status} />
          </p>
        </div>
        <div className="balance big">{formatMoney(account.balance, account.currency)}</div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? 'active' : undefined}
            onClick={() => setSearchParams({ tab: t }, { replace: true })}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'transfers' && <TransfersTab account={account} />}
      {tab === 'deposits' && <DepositsTab account={account} />}
      {tab === 'holds' && <HoldsTab account={account} />}
      {tab === 'postings' && <PostingsTab account={account} />}
    </>
  )
}

function TransfersTab({ account }: { account: Account }) {
  const { data, error, loading, setPage, reload } = usePaged(
    (page, size) => transferApi.forAccount(account.id, page, size),
    [account.id],
  )
  return (
    <>
      <TransferForm account={account} onCreated={reload} />
      <DataTable
        columns={['Date', 'Direction', 'Counterparty', 'Amount', 'Status']}
        rows={data?.content}
        loading={loading}
        error={error}
        empty="No transfers yet."
        rowKey={(t) => t.id}
        renderRow={(t) => {
          const outgoing = t.fromAccountId === account.id
          return (
            <>
              <td>{formatDate(t.createdAt)}</td>
              <td>{outgoing ? 'Sent' : 'Received'}</td>
              <td>Account #{outgoing ? t.toAccountId : t.fromAccountId}</td>
              <td className={`num ${outgoing ? 'neg' : 'pos'}`}>
                {outgoing ? '−' : '+'}
                {formatMoney(t.amount, t.currency)}
              </td>
              <td>
                <StatusBadge status={t.status} />
                {t.failureReason && <div className="muted small">{t.failureReason}</div>}
              </td>
            </>
          )
        }}
      />
      <Pager data={data} onPage={setPage} />
    </>
  )
}

function TransferForm({ account, onCreated }: { account: Account; onCreated: () => void }) {
  const { user } = useAuth()
  const [toAccount, setToAccount] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const toAccountId = Number(toAccount)
    if (!Number.isSafeInteger(toAccountId) || toAccountId <= 0) {
      setError('Enter the number of the account to send to')
      return
    }
    if (toAccountId === account.id) {
      setError("You can't send money to the same account")
      return
    }
    const minor = toMinorUnits(amount, account.currency)
    if (minor === null) {
      setError('Enter a positive amount, e.g. 25.00')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await transferApi.create(account.id, toAccountId, minor, account.currency)
      if (user) rememberRecentAccounts(user.id, [toAccountId])
      setToAccount('')
      setAmount('')
      onCreated()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="inline-form action-form" onSubmit={submit}>
      <AccountPicker
        value={toAccount}
        onChange={setToAccount}
        currency={account.currency}
        exclude={account.id}
        placeholder="To account #"
        label="To account number"
      />
      <input
        inputMode="decimal"
        placeholder={`Amount (${account.currency})`}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        aria-label="Amount"
      />
      <button type="submit" className="primary" disabled={submitting}>
        {submitting ? 'Sending…' : 'Send money'}
      </button>
      <span className="muted small">
        The other account must also be in {account.currency}. Transfers start as PENDING.
      </span>
      <ErrorMessage error={error} />
    </form>
  )
}

function DepositsTab({ account }: { account: Account }) {
  const { data, error, loading, setPage, reload } = usePaged(
    (page, size) => depositApi.forAccount(account.id, page, size),
    [account.id],
  )
  return (
    <>
      <DepositForm account={account} onCreated={reload} />
      <DataTable
        columns={['Date', 'Amount', 'Gateway', 'Reference', 'Status']}
        rows={data?.content}
        loading={loading}
        error={error}
        empty="No deposits yet."
        rowKey={(d) => d.id}
        renderRow={(d) => (
          <>
            <td>{formatDate(d.createdAt)}</td>
            <td className="num">{formatMoney(d.amount, d.currency)}</td>
            <td>{d.gateway}</td>
            <td className="mono">{d.gatewayReference}</td>
            <td>
              <StatusBadge status={d.status} />
              {d.failureReason && <div className="muted small">{d.failureReason}</div>}
            </td>
          </>
        )}
      />
      <Pager data={data} onPage={setPage} />
    </>
  )
}

function DepositForm({ account, onCreated }: { account: Account; onCreated: () => void }) {
  const [amount, setAmount] = useState('')
  const [gateway, setGateway] = useState('manual')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const minor = toMinorUnits(amount, account.currency)
    if (minor === null) {
      setError('Enter a positive amount, e.g. 25.00')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      // The reference identifies the payment at the gateway; a random one stands in until a real gateway exists
      await depositApi.create(account.id, minor, account.currency, gateway, crypto.randomUUID())
      setAmount('')
      onCreated()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="inline-form action-form" onSubmit={submit}>
      <input
        inputMode="decimal"
        placeholder={`Amount (${account.currency})`}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        aria-label="Amount"
      />
      <input value={gateway} onChange={(e) => setGateway(e.target.value)} maxLength={50} aria-label="Gateway" />
      <button type="submit" className="primary" disabled={submitting}>
        {submitting ? 'Creating…' : 'New deposit'}
      </button>
      <span className="muted small">Deposits start as PENDING until the payment gateway confirms them.</span>
      <ErrorMessage error={error} />
    </form>
  )
}

function HoldsTab({ account }: { account: Account }) {
  const { data, error, loading, setPage } = usePaged(
    (page, size) => holdApi.forAccount(account.id, page, size),
    [account.id],
  )
  return (
    <>
      <DataTable
        columns={['Date', 'Amount', 'Status', 'Expires', 'Released']}
        rows={data?.content}
        loading={loading}
        error={error}
        empty="No holds."
        rowKey={(h) => h.id}
        renderRow={(h) => (
          <>
            <td>{formatDate(h.createdAt)}</td>
            <td className="num">{formatMoney(h.amount, h.currency)}</td>
            <td>
              <StatusBadge status={h.status} />
            </td>
            <td>{formatDate(h.expiresAt)}</td>
            <td>{formatDate(h.releasedAt)}</td>
          </>
        )}
      />
      <Pager data={data} onPage={setPage} />
    </>
  )
}

function PostingsTab({ account }: { account: Account }) {
  const { data, error, loading, setPage } = usePaged(
    (page, size) => postingApi.forAccount(account.id, page, size),
    [account.id],
  )
  return (
    <>
      <p className="muted small">Ledger lines for this account. Each journal entry has matching debits and credits.</p>
      <DataTable
        columns={['Date', 'Journal entry', 'Direction', 'Amount']}
        rows={data?.content}
        loading={loading}
        error={error}
        empty="No ledger postings yet."
        rowKey={(p) => p.id}
        renderRow={(p) => (
          <>
            <td>{formatDate(p.createdAt)}</td>
            <td>#{p.journalEntryId}</td>
            <td>{p.direction}</td>
            <td className={`num ${p.direction === 'DEBIT' ? 'neg' : 'pos'}`}>{formatMoney(p.amount, p.currency)}</td>
          </>
        )}
      />
      <Pager data={data} onPage={setPage} />
    </>
  )
}
