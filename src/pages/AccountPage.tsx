import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'

import { forgetMyAccounts, rememberRecentAccounts } from '../accounts'
import { ApiError } from '../api/client'
import { accountApi, depositApi, holdApi, postingApi, transferApi } from '../api/endpoints'
import type { Account, Hold, Transfer } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { AccountPicker } from '../components/AccountPicker'
import { DataTable, ErrorMessage, Pager, StatusBadge, SuccessMessage } from '../components/ui'
import { FEE_PERCENT, TRANSFER_CURRENCIES } from '../currencies'
import { feeOf, formatDate, formatMoney, toMinorUnits } from '../format'
import { usePaged } from '../usePaged'
import { usePolling } from '../usePolling'

const TABS = ['transfers', 'deposits', 'holds', 'postings'] as const
type Tab = (typeof TABS)[number]

export function AccountPage() {
  const accountId = Number(useParams().id)
  const { user } = useAuth()
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

  // Re-reads the balance after money moved; the pickers' cached balances are dropped too
  const reloadAccount = useCallback(() => {
    forgetMyAccounts()
    accountApi
      .get(accountId)
      .then(setAccount)
      .catch(() => undefined)
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

  // Admins can open anyone's account, but only the owner may move its money
  const isOwner = account.userId === user?.id

  return (
    <>
      <p>
        <Link to="/">← Accounts</Link>
      </p>
      {!isOwner && (
        <p className="notice">
          You are viewing user #{account.userId}'s account as an admin. Sending money and deposits are only available
          to the owner.
        </p>
      )}
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

      {tab === 'transfers' && <TransfersTab account={account} isOwner={isOwner} onMoneyMoved={reloadAccount} />}
      {tab === 'deposits' && <DepositsTab account={account} isOwner={isOwner} onMoneyMoved={reloadAccount} />}
      {tab === 'holds' && <HoldsTab account={account} />}
      {tab === 'postings' && <PostingsTab account={account} />}
    </>
  )
}

function TransfersTab({
  account,
  isOwner,
  onMoneyMoved,
}: {
  account: Account
  isOwner: boolean
  onMoneyMoved: () => void
}) {
  const { isAdmin } = useAuth()
  const { data, error, loading, setPage, reload } = usePaged(
    (page, size) => transferApi.forAccount(account.id, page, size),
    [account.id],
  )
  const [reversing, setReversing] = useState<number | null>(null)

  const changed = () => {
    reload()
    onMoneyMoved()
  }

  return (
    <>
      {isOwner && <TransferForm account={account} onBooked={changed} />}
      <DataTable
        columns={isAdmin ? ['Date', 'Direction', 'Counterparty', 'Amount', 'Status', ''] : ['Date', 'Direction', 'Counterparty', 'Amount', 'Status']}
        rows={data?.content}
        loading={loading}
        error={error}
        empty="No transfers yet."
        rowKey={(t) => t.id}
        renderRow={(t) => {
          const outgoing = t.fromAccountId === account.id
          // The fee comes out of what the recipient gets
          const fee = t.status === 'FAILED' ? 0 : feeOf(t.amount)
          const shown = outgoing ? t.amount : t.amount - fee
          return (
            <>
              <td>{formatDate(t.createdAt)}</td>
              <td>{outgoing ? 'Sent' : 'Received'}</td>
              <td>Account #{outgoing ? t.toAccountId : t.fromAccountId}</td>
              <td className={`num ${outgoing ? 'neg' : 'pos'}`}>
                {outgoing ? '−' : '+'}
                {formatMoney(shown, t.currency)}
                {!outgoing && fee > 0 && <div className="muted small">after {formatMoney(fee, t.currency)} fee</div>}
              </td>
              <td>
                <StatusBadge status={t.status} />
                {t.failureReason && <div className="muted small">{t.failureReason}</div>}
              </td>
              {isAdmin && (
                <td className="actions">
                  <Link to={`/admin/journal?type=transfer&id=${t.id}`}>Journal</Link>
                  {t.status === 'COMPLETED' && reversing !== t.id && (
                    <button onClick={() => setReversing(t.id)}>Reverse</button>
                  )}
                </td>
              )}
            </>
          )
        }}
        renderDetail={(t) =>
          reversing === t.id ? (
            <ReverseForm
              transfer={t}
              onCancel={() => setReversing(null)}
              onReversed={() => {
                setReversing(null)
                changed()
              }}
            />
          ) : null
        }
      />
      <Pager data={data} onPage={setPage} />
    </>
  )
}

function TransferForm({ account, onBooked }: { account: Account; onBooked: () => void }) {
  const { user } = useAuth()
  const [toAccount, setToAccount] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // One key per distinct request: resubmitting after a lost response can't send the money twice,
  // while a changed amount or recipient gets a fresh key (the backend refuses a reused key with a different body)
  const attempt = useRef<{ signature: string; key: string } | null>(null)

  if (!TRANSFER_CURRENCIES.includes(account.currency)) {
    return (
      <p className="muted small action-form">
        Transfers in {account.currency} are not enabled. Only {TRANSFER_CURRENCIES.join(' and ')} accounts can send
        money.
      </p>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSuccess(null)
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
    const signature = `${toAccountId}:${minor}`
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() }

    setSubmitting(true)
    setError(null)
    try {
      const transfer = await transferApi.create(account.id, toAccountId, minor, account.currency, attempt.current.key)
      attempt.current = null
      if (transfer.status === 'FAILED') {
        setError(`Transfer failed: ${transfer.failureReason ?? 'unknown reason'}`)
      } else {
        setSuccess(`Sent ${formatMoney(transfer.amount, transfer.currency)} to account #${transfer.toAccountId}.`)
        if (user) rememberRecentAccounts(user.id, [toAccountId])
        setToAccount('')
        setAmount('')
      }
      onBooked()
    } catch (err) {
      // Only a network error leaves the key for the retry; any answer from the server was final
      if (!(err instanceof ApiError && err.status === 0)) attempt.current = null
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
        The other account must also be in {account.currency}. The recipient gets the amount minus a {FEE_PERCENT}% fee.
      </span>
      <ErrorMessage error={error} />
      <SuccessMessage message={success} />
    </form>
  )
}

function ReverseForm({
  transfer,
  onCancel,
  onReversed,
}: {
  transfer: Transfer
  onCancel: () => void
  onReversed: () => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError('Give a reason; it is recorded in the reversal journal entry')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await transferApi.reverse(transfer.id, reason.trim())
      onReversed()
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <span>
        Reverse transfer #{transfer.id} of {formatMoney(transfer.amount, transfer.currency)}, fee included?
      </span>
      <input
        placeholder="Reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={200}
        aria-label="Reason for the reversal"
        autoFocus
      />
      <button type="submit" className="danger" disabled={submitting}>
        {submitting ? 'Reversing…' : 'Reverse'}
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
      <ErrorMessage error={error} />
    </form>
  )
}

function DepositsTab({
  account,
  isOwner,
  onMoneyMoved,
}: {
  account: Account
  isOwner: boolean
  onMoneyMoved: () => void
}) {
  const { data, error, loading, setPage, reload, refresh } = usePaged(
    (page, size) => depositApi.forAccount(account.id, page, size),
    [account.id],
  )

  // The bank confirms deposits asynchronously, so pending ones are re-read until they settle
  const pending = data?.content.some((d) => d.status === 'PENDING') ?? false
  const poll = useCallback(() => {
    refresh()
    onMoneyMoved()
  }, [refresh, onMoneyMoved])
  usePolling(pending, poll)

  return (
    <>
      {isOwner && <DepositForm account={account} onCreated={reload} />}
      <DataTable
        columns={['Date', 'Amount', 'Credited', 'Bank reference', 'Status']}
        rows={data?.content}
        loading={loading}
        error={error}
        empty="No deposits yet."
        rowKey={(d) => d.id}
        renderRow={(d) => (
          <>
            <td>{formatDate(d.createdAt)}</td>
            <td className="num">{formatMoney(d.amount, d.currency)}</td>
            <td className="num">
              {d.status === 'SUCCEEDED' ? formatMoney(d.amount - feeOf(d.amount), d.currency) : '—'}
            </td>
            <td className="mono">{d.gatewayReference ?? '—'}</td>
            <td>
              <StatusBadge status={d.status} />
              {d.status === 'PENDING' && d.expiresAt && (
                <div className="muted small">waiting for the bank until {formatDate(d.expiresAt)}</div>
              )}
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
      await depositApi.create(account.id, minor, account.currency)
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
      <button type="submit" className="primary" disabled={submitting}>
        {submitting ? 'Creating…' : 'Top up'}
      </button>
      <span className="muted small">
        The bank confirms the payment in a few seconds; {FEE_PERCENT}% is kept as a fee.
      </span>
      <ErrorMessage error={error} />
    </form>
  )
}

function HoldsTab({ account }: { account: Account }) {
  const { isAdmin } = useAuth()
  const { data, error, loading, setPage, reload } = usePaged(
    (page, size) => holdApi.forAccount(account.id, page, size),
    [account.id],
  )
  const [actionError, setActionError] = useState<string | null>(null)

  const expire = async (hold: Hold) => {
    setActionError(null)
    try {
      await holdApi.expire(hold.id)
      reload()
    } catch (err) {
      setActionError((err as Error).message)
    }
  }

  const reserved = data?.content.filter((h) => h.status === 'ACTIVE').reduce((sum, h) => sum + h.amount, 0) ?? 0

  return (
    <>
      <p className="muted small">
        Money a merchant has reserved, e.g. at checkout. Active holds can't be spent until they are captured, released
        or expire.
        {reserved > 0 && <> Reserved on this page: {formatMoney(reserved, account.currency)}.</>}
      </p>
      <ErrorMessage error={actionError} />
      <DataTable
        columns={['#', 'Date', 'Amount', 'Merchant', 'Status', 'Expires', ...(isAdmin ? [''] : [])]}
        rows={data?.content}
        loading={loading}
        error={error}
        empty="No holds."
        rowKey={(h) => h.id}
        renderRow={(h) => (
          <>
            <td>{h.id}</td>
            <td>{formatDate(h.createdAt)}</td>
            <td className="num">{formatMoney(h.amount, h.currency)}</td>
            <td>{h.merchantId ? `User #${h.merchantId}` : '—'}</td>
            <td>
              <StatusBadge status={h.status} />
              {h.releasedAt && <div className="muted small">released {formatDate(h.releasedAt)}</div>}
            </td>
            <td>{formatDate(h.expiresAt)}</td>
            {isAdmin && (
              <td className="actions">
                {h.status === 'ACTIVE' && new Date(h.expiresAt).getTime() <= Date.now() && (
                  <button onClick={() => expire(h)}>Expire now</button>
                )}
              </td>
            )}
          </>
        )}
      />
      <Pager data={data} onPage={setPage} />
    </>
  )
}

function PostingsTab({ account }: { account: Account }) {
  const { isAdmin } = useAuth()
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
            <td>
              {isAdmin ? <Link to={`/admin/journal?entry=${p.journalEntryId}`}>#{p.journalEntryId}</Link> : `#${p.journalEntryId}`}
            </td>
            <td>{p.direction}</td>
            <td className={`num ${p.direction === 'DEBIT' ? 'neg' : 'pos'}`}>{formatMoney(p.amount, p.currency)}</td>
          </>
        )}
      />
      <Pager data={data} onPage={setPage} />
    </>
  )
}
