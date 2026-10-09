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
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED'
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
  gatewayReference: string
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
}

export interface Posting {
  id: number
  journalEntryId: number
  accountId: number
  direction: 'DEBIT' | 'CREDIT'
  amount: number
  currency: string
  createdAt: string
}

export interface JournalEntry {
  id: number
  createdAt: string
  entryType: string
  description: string | null
  referenceType: string | null
  referenceId: number | null
  postings: Posting[] | null
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
