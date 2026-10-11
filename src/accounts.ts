// Account suggestions for the account pickers. The backend only lists the logged-in user's own accounts,
// so other people's accounts are suggested from the ones this user has used before in this browser.

import { accountApi } from './api/endpoints'
import type { Account } from './api/types'

const RECENT_LIMIT = 8

// One request per user, shared by every picker on the page
const mineCache = new Map<number, Promise<Account[]>>()

export function loadMyAccounts(userId: number): Promise<Account[]> {
  let accounts = mineCache.get(userId)
  if (!accounts) {
    accounts = accountApi.mine()
    // A failed load is tried again next time instead of being cached
    accounts.catch(() => mineCache.delete(userId))
    mineCache.set(userId, accounts)
  }
  return accounts
}

/** Call after opening an account or when the session changes, so pickers reload the list. */
export function forgetMyAccounts() {
  mineCache.clear()
}

const recentKey = (userId: number) => `wallet.recentAccounts.${userId}`

export function readRecentAccounts(userId: number): number[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(recentKey(userId)) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isSafeInteger(id)) : []
  } catch {
    return []
  }
}

/** Remembers account numbers the user sent to or used, most recent first. */
export function rememberRecentAccounts(userId: number, ids: number[]) {
  const recent = [...new Set([...ids, ...readRecentAccounts(userId)])].slice(0, RECENT_LIMIT)
  try {
    localStorage.setItem(recentKey(userId), JSON.stringify(recent))
  } catch {
    // Storage unavailable: suggestions just won't include recent accounts
  }
}
