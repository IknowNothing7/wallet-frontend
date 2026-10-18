import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'

import { AuthProvider, useAuth } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { AccountPage } from './pages/AccountPage'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import { DashboardPage } from './pages/DashboardPage'
import { JournalPage } from './pages/admin/JournalPage'
import { OutboxPage } from './pages/admin/OutboxPage'
import { UsersPage } from './pages/admin/UsersPage'
import { HoldsPage } from './pages/merchant/HoldsPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, restoring } = useAuth()
  const location = useLocation()
  if (restoring) return <p className="muted center">Loading…</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return children
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  return isAdmin ? children : <Navigate to="/" replace />
}

function RequireMerchant({ children }: { children: ReactNode }) {
  const { isMerchant } = useAuth()
  return isMerchant ? children : <Navigate to="/" replace />
}

// Login and register are pointless once logged in. This also performs the redirect after logging in,
// back to the page that sent the user to /login (RequireAuth puts it in the location state).
function GuestOnly({ children }: { children: ReactNode }) {
  const { user, restoring } = useAuth()
  const location = useLocation()
  if (restoring) return <p className="muted center">Loading…</p>
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  return user ? <Navigate to={from} replace /> : children
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<DashboardPage />} />
            <Route path="accounts/:id" element={<AccountPage />} />
            <Route path="merchant/holds" element={<RequireMerchant><HoldsPage /></RequireMerchant>} />
            <Route path="admin/journal" element={<RequireAdmin><JournalPage /></RequireAdmin>} />
            <Route path="admin/outbox" element={<RequireAdmin><OutboxPage /></RequireAdmin>} />
            <Route path="admin/users" element={<RequireAdmin><UsersPage /></RequireAdmin>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
