import { api, publicApi } from './client'
import type {
  Account,
  AuthResponse,
  Deposit,
  Hold,
  JournalEntry,
  JournalEntryRequest,
  OutboxEvent,
  OutboxStatus,
  PageResponse,
  Posting,
  PostingRequest,
  Transfer,
} from './types'

const paging = (page: number, size: number) => `page=${page}&size=${size}`

export const authApi = {
  login: (email: string, password: string) =>
    publicApi<AuthResponse>('POST', '/api/auth/login', { email, password }),
  register: (name: string, email: string, password: string, confirmPassword: string) =>
    publicApi<AuthResponse>('POST', '/api/auth/register', { name, email, password, confirmPassword }),
}

export const accountApi = {
  mine: () => api<Account[]>('GET', '/account'),
  get: (id: number) => api<Account>('GET', `/account/${id}`),
  create: (currency: string, userId: number) => api<Account>('POST', '/account/create', { currency, userId }),
}

export const transferApi = {
  forAccount: (accountId: number, page: number, size: number) =>
    api<PageResponse<Transfer>>('GET', `/transfer/account/${accountId}?${paging(page, size)}`),
  // The request names the accounts idFromAccount / idToAccount, unlike the response's fromAccountId / toAccountId
  create: (fromAccountId: number, toAccountId: number, amount: number, currency: string) =>
    api<Transfer>('POST', '/transfer/create', {
      idFromAccount: fromAccountId,
      idToAccount: toAccountId,
      amount,
      currency,
    }),
}

export const depositApi = {
  forAccount: (accountId: number, page: number, size: number) =>
    api<PageResponse<Deposit>>('GET', `/deposit/account/${accountId}?${paging(page, size)}`),
  create: (accountId: number, amount: number, currency: string, gateway: string, gatewayReference: string) =>
    api<Deposit>('POST', '/deposit/create', { accountId, amount, currency, gateway, gatewayReference }),
}

export const holdApi = {
  forAccount: (accountId: number, page: number, size: number) =>
    api<PageResponse<Hold>>('GET', `/hold/account/${accountId}?${paging(page, size)}`),
  // Merchants only; expiresAt is an ISO instant in the future
  create: (accountId: number, amount: number, currency: string, expiresAt: string) =>
    api<Hold>('POST', '/hold/create', { accountId, amount, currency, expiresAt }),
}

export const postingApi = {
  forAccount: (accountId: number, page: number, size: number) =>
    api<PageResponse<Posting>>('GET', `/posting/account/${accountId}?${paging(page, size)}`),
  // Admins only; debits must equal credits per currency
  addToEntry: (journalEntryId: number, postings: PostingRequest[]) =>
    api<Posting[]>('POST', `/posting/journal-entry/${journalEntryId}`, postings),
}

export const journalApi = {
  list: (page: number, size: number) => api<PageResponse<JournalEntry>>('GET', `/journal-entry?${paging(page, size)}`),
  get: (id: number) => api<JournalEntry>('GET', `/journal-entry/${id}`),
  create: (request: JournalEntryRequest) => api<JournalEntry>('POST', '/journal-entry/create', request),
  byReference: (type: string, id: number) =>
    api<JournalEntry[]>('GET', `/journal-entry/reference?type=${encodeURIComponent(type)}&id=${id}`),
}

export const outboxApi = {
  list: (status: OutboxStatus | '', page: number, size: number) =>
    api<PageResponse<OutboxEvent>>('GET', `/outbox?${status ? `status=${status}&` : ''}${paging(page, size)}`),
  retry: (id: number) => api<OutboxEvent>('POST', `/outbox/${id}/retry`),
}
