import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'

import { loadMyAccounts, readRecentAccounts } from '../accounts'
import type { Account } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { formatMoney } from '../format'

interface Option {
  id: number
  group: 'Your accounts' | 'Recently used'
  account: Account | null
}

/**
 * Text field for an account number with a drop-down of suggestions: the user's own accounts and the
 * accounts they used recently. Any number can still be typed, since other users' accounts can't be listed.
 */
export function AccountPicker({
  value,
  onChange,
  onPick,
  currency,
  exclude,
  includeMine = true,
  placeholder = 'Account #',
  label,
  testId,
}: {
  value: string
  onChange: (value: string) => void
  /** Called when one of the user's own accounts is chosen from the list. */
  onPick?: (account: Account) => void
  /** Only suggest own accounts in this currency. */
  currency?: string
  /** Account to leave out, e.g. the one money is sent from. */
  exclude?: number
  /** False where the user's own accounts make no sense, e.g. a merchant holding a customer's funds. */
  includeMine?: boolean
  placeholder?: string
  label: string
  /** Test id of the input; the list and options get `<testId>-list` and `<testId>-option-<id>`. */
  testId: string
}) {
  const { user } = useAuth()
  const listId = useId()
  const [mine, setMine] = useState<Account[]>([])
  const [recent, setRecent] = useState<number[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  useEffect(() => {
    if (!user || !includeMine) return
    let cancelled = false
    loadMyAccounts(user.id)
      .then((accounts) => !cancelled && setMine(accounts))
      // Without the list the field still works as a plain number input
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [user, includeMine])

  const options = useMemo<Option[]>(() => {
    const own = mine
      .filter((a) => a.id !== exclude && (!currency || a.currency === currency))
      .map((a): Option => ({ id: a.id, group: 'Your accounts', account: a }))
    const ownIds = new Set(mine.map((a) => a.id))
    const others = recent
      .filter((id) => id !== exclude && !ownIds.has(id))
      .map((id): Option => ({ id, group: 'Recently used', account: null }))
    const query = value.trim().replace(/^#/, '')
    return [...own, ...others].filter((o) => !query || String(o.id).startsWith(query))
  }, [mine, recent, exclude, currency, value])

  const show = open && options.length > 0

  const openList = () => {
    // Re-read so accounts used a moment ago in another form show up
    if (user) setRecent(readRecentAccounts(user.id))
    setOpen(true)
  }

  const choose = (option: Option) => {
    onChange(String(option.id))
    if (option.account) onPick?.(option.account)
    setOpen(false)
    setActive(-1)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) openList()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (options.length === 0 ? -1 : (i + step + options.length) % options.length))
    } else if (e.key === 'Enter' && show && active >= 0 && active < options.length) {
      // Picks the highlighted account instead of submitting the form
      e.preventDefault()
      choose(options[active])
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="picker">
      <input
        role="combobox"
        aria-label={label}
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setActive(-1)
          if (!open) openList()
        }}
        onFocus={openList}
        onClick={() => !open && openList()}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        data-testid={testId}
      />
      {show && (
        <ul id={listId} role="listbox" className="picker-list" data-testid={`${testId}-list`}>
          {options.map((option, index) => (
            <li key={`${option.group}-${option.id}`} role="presentation">
              {(index === 0 || options[index - 1].group !== option.group) && (
                <div className="picker-group" aria-hidden="true">
                  {option.group}
                </div>
              )}
              <div
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={index === active ? 'picker-option active' : 'picker-option'}
                // mousedown would blur the input and close the list before the click lands
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(option)}
                onMouseEnter={() => setActive(index)}
                data-testid={`${testId}-option-${option.id}`}
              >
                <span>#{option.id}</span>
                {option.account && (
                  <span className="muted">
                    {option.account.currency} · {formatMoney(option.account.balance, option.account.currency)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
