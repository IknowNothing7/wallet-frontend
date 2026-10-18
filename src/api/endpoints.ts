import { api, publicApi } from './client'
import type {
  Account,
  AuthResponse,
  Deposit,
  Hold,
  JournalEntry,
  OutboxEvent,
  OutboxStatus,
  PageResponse,
  Posting,
  Transfer,
  User,
  UserRole,
  UserSearch,
} from './types'

const paging = (page: number, size: number) => `page=${page}&size=${size}`

export const authApi = {
  login: (email: string, password: string) =>
    publicApi<AuthResponse>('POST', '/api/auth/login', { email, password }),
  register: (name: string, email: string, password: string, confirmPassword: string) =>
    publicApi<AuthResponse>('POST', '/api/auth/register', { name, email, password, confirmPassword }),
}

export const accountApi = {
  mine: () => api<Account[]>('GET', '/api/accounts'),
  // Admins may read any user account
  get: (id: number) => api<Account>('GET', `/api/accounts/${id}`),
  // Always opened for the logged-in user; a second account in the same currency is a 409
  create: (currency: string) => api<Account>('POST', '/api/accounts', { currency }),
}

export const transferApi = {
  forAccount: (accountId: number, page: number, size: number) =>
    api<PageResponse<Transfer>>('GET', `/api/accounts/${accountId}/transfers?${paging(page, size)}`),
  // The request names the accounts idFromAccount / idToAccount, unlike the response's fromAccountId / toAccountId.
  // Repeating a request with the same idempotency key returns the first result instead of sending money twice.
  create: (fromAccountId: number, toAccountId: number, amount: number, currency: string, idempotencyKey: string) =>
    api<Transfer>(
      'POST',
      '/api/transfers',
      { idFromAccount: fromAccountId, idToAccount: toAccountId, amount, currency },
      { 'Idempotency-Key': idempotencyKey },
    ),
  // Admins only; refused if the recipient no longer has the money
  reverse: (id: number, reason: string) => api<Transfer>('POST', `/api/transfers/${id}/reverse`, { reason }),
}

// bank-sim is the only payment provider; it assigns the gateway reference itself
const DEPOSIT_GATEWAY = 'bank-sim'

export const depositApi = {
  forAccount: (accountId: number, page: number, size: number) =>
    api<PageResponse<Deposit>>('GET', `/api/accounts/${accountId}/deposits?${paging(page, size)}`),
  create: (accountId: number, amount: number, currency: string) =>
    api<Deposit>('POST', '/api/deposits', { accountId, amount, currency, gateway: DEPOSIT_GATEWAY }),
}

export const holdApi = {
  forAccount: (accountId: number, page: number, size: number) =>
    api<PageResponse<Hold>>('GET', `/api/accounts/${accountId}/holds?${paging(page, size)}`),
  // Visible to the account owner, admins and the merchant who placed it
  get: (id: number) => api<Hold>('GET', `/api/holds/${id}`),
  // Merchants only; expiresAt is an ISO instant in the future, at most 7 days away
  create: (accountId: number, amount: number, currency: string, expiresAt: string) =>
    api<Hold>('POST', '/api/holds', { accountId, amount, currency, expiresAt }),
  // The hold's merchant only; the destination must be one of the merchant's own accounts in the hold's currency
  capture: (id: number, destinationAccountId: number) =>
    api<Hold>('POST', `/api/holds/${id}/capture`, { destinationAccountId }),
  release: (id: number) => api<Hold>('POST', `/api/holds/${id}/release`),
  // Admins only, and only once expiresAt has passed (a background job does the same every 30 s)
  expire: (id: number) => api<Hold>('POST', `/api/holds/${id}/expire`),
}

export const postingApi = {
  forAccount: (accountId: number, page: number, size: number) =>
    api<PageResponse<Posting>>('GET', `/api/accounts/${accountId}/postings?${paging(page, size)}`),
}

// Read-only: the ledger is written only by transfers, deposits and hold captures
export const journalApi = {
  list: (page: number, size: number) =>
    api<PageResponse<JournalEntry>>('GET', `/api/journal-entries?${paging(page, size)}`),
  get: (id: number) => api<JournalEntry>('GET', `/api/journal-entries/${id}`),
  byReference: (type: string, id: number) =>
    api<JournalEntry[]>('GET', `/api/journal-entries/reference?type=${encodeURIComponent(type)}&id=${id}`),
}

export const outboxApi = {
  list: (status: OutboxStatus | '', page: number, size: number) =>
    api<PageResponse<OutboxEvent>>('GET', `/api/outbox-events?${status ? `status=${status}&` : ''}${paging(page, size)}`),
  retry: (id: number) => api<OutboxEvent>('POST', `/api/outbox-events/${id}/retry`),
}

export const userApi = {
  // Admins only
  list: (search: UserSearch, page: number, size: number) => {
    const params = new URLSearchParams()
    if (search.keyword) params.set('keyword', search.keyword)
    if (search.sortField) params.set('sortField', search.sortField)
    return api<PageResponse<User>>('GET', `/api/users?${params.size ? `${params}&` : ''}${paging(page, size)}`)
  },
  // USER or MERCHANT; ADMIN can't be granted or taken away
  changeRole: (id: number, role: Exclude<UserRole, 'ADMIN'>) =>
    api<User>('PUT', `/api/users/${id}/role`, { role }),
}
