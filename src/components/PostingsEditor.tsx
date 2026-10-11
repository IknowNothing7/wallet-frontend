import type { PostingDirection, PostingRequest } from '../api/types'
import { CURRENCIES } from '../currencies'
import { AccountPicker } from './AccountPicker'
import { formatMoney, toMinorUnits } from '../format'

/** One editable posting line; fields are kept as typed until submit. */
export interface PostingDraft {
  key: number
  accountId: string
  direction: PostingDirection
  amount: string
  currency: string
}

let nextKey = 0

export function newPostingDraft(direction: PostingDirection, currency = 'USD'): PostingDraft {
  return { key: nextKey++, accountId: '', direction, amount: '', currency }
}

/** A balanced pair to start from: one debit, one credit. */
export function initialPostingDrafts(): PostingDraft[] {
  return [newPostingDraft('DEBIT'), newPostingDraft('CREDIT')]
}

/**
 * Converts the drafts into request bodies, or returns an error message. The backend needs at least two
 * postings, and debits must equal credits within each currency.
 */
export function toPostingRequests(drafts: PostingDraft[]): PostingRequest[] | string {
  if (drafts.length < 2) return 'Add at least two postings'
  const requests: PostingRequest[] = []
  for (const [index, draft] of drafts.entries()) {
    const accountId = Number(draft.accountId)
    if (!Number.isSafeInteger(accountId) || accountId <= 0) return `Line ${index + 1}: enter an account number`
    const amount = toMinorUnits(draft.amount, draft.currency)
    if (amount === null) return `Line ${index + 1}: enter a positive amount`
    requests.push({ accountId, direction: draft.direction, amount, currency: draft.currency })
  }
  if (imbalances(requests).length > 0) return 'Debits and credits must be equal in each currency'
  return requests
}

// Currencies whose debits and credits differ, with the difference (debits minus credits) in minor units
function imbalances(postings: PostingRequest[]): [string, number][] {
  const net = new Map<string, number>()
  for (const p of postings) {
    net.set(p.currency, (net.get(p.currency) ?? 0) + (p.direction === 'DEBIT' ? p.amount : -p.amount))
  }
  return [...net].filter(([, difference]) => difference !== 0)
}

function BalanceStatus({ drafts }: { drafts: PostingDraft[] }) {
  // Only lines with a valid amount count; the rest are reported on submit
  const valid = drafts.flatMap((d) => {
    const amount = toMinorUnits(d.amount, d.currency)
    return amount === null ? [] : [{ accountId: 0, direction: d.direction, amount, currency: d.currency }]
  })
  if (valid.length === 0) return null
  const off = imbalances(valid)
  if (off.length === 0) return <span className="badge badge-good">Balanced</span>
  return (
    <span className="badge badge-warn">
      Unbalanced:{' '}
      {off
        .map(([currency, diff]) => `${formatMoney(Math.abs(diff), currency)} more ${diff > 0 ? 'debit' : 'credit'}`)
        .join(', ')}
    </span>
  )
}

export function PostingsEditor({
  drafts,
  onChange,
}: {
  drafts: PostingDraft[]
  onChange: (drafts: PostingDraft[]) => void
}) {
  const update = (key: number, change: Partial<PostingDraft>) =>
    onChange(drafts.map((d) => (d.key === key ? { ...d, ...change } : d)))

  return (
    <div className="postings-editor">
      {drafts.map((d, index) => (
        <div key={d.key} className="posting-draft">
          <AccountPicker
            value={d.accountId}
            onChange={(accountId) => update(d.key, { accountId })}
            // An own account's currency is known, so the line follows it
            onPick={(account) => update(d.key, { accountId: String(account.id), currency: account.currency })}
            label={`Line ${index + 1} account number`}
          />
          <select
            value={d.direction}
            onChange={(e) => update(d.key, { direction: e.target.value as PostingDirection })}
            aria-label={`Line ${index + 1} direction`}
          >
            <option>DEBIT</option>
            <option>CREDIT</option>
          </select>
          <input
            inputMode="decimal"
            placeholder="Amount"
            value={d.amount}
            onChange={(e) => update(d.key, { amount: e.target.value })}
            aria-label={`Line ${index + 1} amount`}
          />
          <select
            value={d.currency}
            onChange={(e) => update(d.key, { currency: e.target.value })}
            aria-label={`Line ${index + 1} currency`}
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onChange(drafts.filter((x) => x.key !== d.key))}
            disabled={drafts.length <= 2}
            aria-label={`Remove line ${index + 1}`}
          >
            ×
          </button>
        </div>
      ))}
      <div className="inline-form">
        <button
          type="button"
          onClick={() => onChange([...drafts, newPostingDraft('CREDIT', drafts.at(-1)?.currency)])}
        >
          + Add line
        </button>
        <BalanceStatus drafts={drafts} />
      </div>
    </div>
  )
}
