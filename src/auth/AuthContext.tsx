import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { forgetMyAccounts } from '../accounts'
import { hasStoredSession, logoutSession, refreshSession, setSessionListener, startSession } from '../api/client'
import { authApi } from '../api/endpoints'
import type { User } from '../api/types'

interface AuthState {
  user: User | null
  isAdmin: boolean
  isMerchant: boolean
  // True while a stored session is being restored on page load
  restoring: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, confirmPassword: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [restoring, setRestoring] = useState(hasStoredSession)

  useEffect(() => {
    // Keeps React state in sync with the API client, e.g. when a failed refresh ends the session
    setSessionListener((auth) => {
      if (!auth) forgetMyAccounts()
      setUser(auth?.user ?? null)
    })
    if (hasStoredSession()) {
      refreshSession().finally(() => setRestoring(false))
    }
    return () => setSessionListener(null)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    startSession(await authApi.login(email, password))
  }, [])

  const register = useCallback(async (name: string, email: string, password: string, confirmPassword: string) => {
    startSession(await authApi.register(name, email, password, confirmPassword))
  }, [])

  const logout = useCallback(() => logoutSession(), [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      isAdmin: user?.role === 'ADMIN',
      isMerchant: user?.role === 'MERCHANT',
      restoring,
      login,
      register,
      logout,
    }),
    [user, restoring, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
