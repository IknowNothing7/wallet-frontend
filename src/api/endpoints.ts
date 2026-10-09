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
}

export const postingApi = {
  forAccount: (accountId: number, page: number, size: number) =>
    api<PageResponse<Posting>>('GET', `/posting/account/${accountId}?${paging(page, size)}`),
}

export const journalApi = {
  list: (page: number, size: number) => api<PageResponse<JournalEntry>>('GET', `/journal-entry?${paging(page, size)}`),
  get: (id: number) => api<JournalEntry>('GET', `/journal-entry/${id}`),
}

export const outboxApi = {
  list: (status: OutboxStatus | '', page: number, size: number) =>
    api<PageResponse<OutboxEvent>>('GET', `/outbox?${status ? `status=${status}&` : ''}${paging(page, size)}`),
  retry: (id: number) => api<OutboxEvent>('POST', `/outbox/${id}/retry`),
}
