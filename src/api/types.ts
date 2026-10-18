// Shapes returned by wallet-platform. Amounts are integers in minor units (cents).

export interface ApiResponse<T> {
  message: string
  payload: T
  success: boolean
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export type UserRole = 'USER' | 'ADMIN' | 'MERCHANT'

export interface User {
  id: number
  createdAt: string
  updatedAt: string
  name: string
  email: string
  role: UserRole
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  user: User
}

export interface Account {
  id: number
  createdAt: string
  updatedAt: string
  balance: number
  currency: string
  type: string
  status: string
  userId: number
}

export interface Transfer {
  id: number
  createdAt: string
  updatedAt: string
  fromAccountId: number
  toAccountId: number
  amount: number
  currency: string
  // Booked synchronously: a new transfer is already COMPLETED or FAILED
  status: 'COMPLETED' | 'FAILED' | 'REVERSED'
  failureReason: string | null
}

export interface Deposit {
  id: number
  createdAt: string
  updatedAt: string
  accountId: number
  amount: number
  currency: string
  gateway: string
  // Assigned by the bank once it has the payment
  gatewayReference: string | null
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED'
  failureReason: string | null
  expiresAt: string | null
}

export interface Hold {
  id: number
  createdAt: string
  updatedAt: string
  accountId: number
  amount: number
  currency: string
  status: 'ACTIVE' | 'CAPTURED' | 'RELEASED' | 'EXPIRED'
  expiresAt: string
  capturedEntryId: number | null
  releasedAt: string | null
  // The user who placed the hold; only they may capture or release it
  merchantId: number | null
}

export type PostingDirection = 'DEBIT' | 'CREDIT'

export interface Posting {
  id: number
  journalEntryId: number
  accountId: number
  direction: PostingDirection
  amount: number
  currency: string
  createdAt: string
}

export const JOURNAL_ENTRY_TYPES = [
  'TRANSFER',
  'DEPOSIT',
  'WITHDRAWAL',
  'FEE',
  'HOLD_CAPTURE',
  'HOLD_RELEASE',
  'REVERSAL',
] as const

export type JournalEntryType = (typeof JOURNAL_ENTRY_TYPES)[number]

export interface JournalEntry {
  id: number
  createdAt: string
  entryType: JournalEntryType
  description: string | null
  referenceType: string | null
  referenceId: number | null
  postings: Posting[] | null
}

// What a journal entry's referenceType can be; each business object books under its own name
export const REFERENCE_TYPES = ['transfer', 'deposit', 'hold'] as const

export type UserSortField = 'NAME' | 'EMAIL'

export interface UserSearch {
  keyword?: string
  sortField?: UserSortField
}

export type OutboxStatus = 'PENDING' | 'PUBLISHED' | 'FAILED'

export interface OutboxEvent {
  id: number
  createdAt: string
  publishedAt: string | null
  aggregateType: string
  aggregateId: number
  eventType: string
  payload: unknown
  status: OutboxStatus
  attempts: number
  lastError: string | null
}
