import type { ApiResponse, AuthResponse } from './types'

const BASE_URL = import.meta.env.VITE_API_URL || '/backend'
const REFRESH_TOKEN_KEY = 'wallet.refreshToken'

export class ApiError extends Error {
  readonly status: number
  // Per-field messages for 400 "Validation failed" responses
  readonly fieldErrors: Record<string, string> | null

  constructor(message: string, status: number, fieldErrors: Record<string, string> | null = null) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

// The access token lives only in memory; the refresh token is kept in localStorage so a page reload
// stays logged in. (localStorage is readable by any script on the page; an httpOnly cookie would be
// safer but needs backend support.)
let accessToken: string | null = null
let onSessionChange: ((auth: AuthResponse | null) => void) | null = null
let refreshInFlight: Promise<AuthResponse | null> | null = null

export function setSessionListener(listener: ((auth: AuthResponse | null) => void) | null) {
  onSessionChange = listener
}

function readRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

function writeRefreshToken(token: string | null) {
  try {
    if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token)
    else localStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch {
    // Storage unavailable (private mode etc.): the session just won't survive a reload
  }
}

export function startSession(auth: AuthResponse) {
  accessToken = auth.accessToken
  writeRefreshToken(auth.refreshToken)
  onSessionChange?.(auth)
}

export function endSession() {
  accessToken = null
  writeRefreshToken(null)
  onSessionChange?.(null)
}

export function getAccessToken() {
  return accessToken
}

export function hasStoredSession() {
  return readRefreshToken() !== null
}

/**
 * Exchanges the stored refresh token for new tokens. Concurrent callers share one request: the backend
 * rotates refresh tokens and treats a second use of the same token as theft, revoking every session.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = readRefreshToken()
      if (!refreshToken) return null
      try {
        const auth = await send<AuthResponse>('POST', '/api/auth/refresh', { refreshToken }, false)
        startSession(auth)
        return auth
      } catch (error) {
        // Only a rejected token ends the session; a network error leaves it for the next try
        if (error instanceof ApiError && error.status === 401) endSession()
        return null
      }
    })().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

async function send<T>(method: string, path: string, body: unknown, withAuth: boolean): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (withAuth && accessToken) headers.Authorization = `Bearer ${accessToken}`

  let response: Response
  try {
    response = await fetch(BASE_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Cannot reach the server', 0)
  }

  if (response.status === 204) return undefined as T

  const json = (await response.json().catch(() => null)) as ApiResponse<unknown> | null
  if (!response.ok || !json || !json.success) {
    const message = json?.message || response.statusText || `Request failed (${response.status})`
    const fieldErrors =
      json?.payload && typeof json.payload === 'object' && !Array.isArray(json.payload)
        ? (json.payload as Record<string, string>)
        : null
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      throw new ApiError(retryAfter ? `${message} (retry in ${retryAfter}s)` : message, 429)
    }
    throw new ApiError(message, response.status, response.status === 400 ? fieldErrors : null)
  }
  return json.payload as T
}

/** Authenticated request; on 401 refreshes the access token once and retries. */
export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  try {
    return await send<T>(method, path, body, true)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && hasStoredSession()) {
      const refreshed = await refreshSession()
      if (refreshed) return send<T>(method, path, body, true)
    }
    throw error
  }
}

/**
 * Revokes the refresh token and the current access token on the server, then clears the local session.
 * The local session is cleared even if the request fails, so logging out always works.
 */
export async function logoutSession() {
  const refreshToken = readRefreshToken()
  if (refreshToken) {
    await send<void>('POST', '/api/auth/logout', { refreshToken }, true).catch(() => undefined)
  }
  endSession()
}

/** Unauthenticated request (login, register). */
export function publicApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  return send<T>(method, path, body, false)
}
