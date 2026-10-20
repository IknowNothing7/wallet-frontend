import { NavLink, Outlet, useNavigate } from 'react-router'

import { useAuth } from '../auth/AuthContext'

export function Layout() {
  const { user, isAdmin, isMerchant, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app">
      <header className="topbar" data-testid="topbar">
        <NavLink to="/" className="brand" data-testid="nav-brand">
          Wallet
        </NavLink>
        <nav>
          <NavLink to="/" end data-testid="nav-accounts">
            Accounts
          </NavLink>
          {isMerchant && <NavLink to="/merchant/holds" data-testid="nav-holds">Holds</NavLink>}
          {isAdmin && (
            <>
              <NavLink to="/admin/users" data-testid="nav-users">Users</NavLink>
              <NavLink to="/admin/journal" data-testid="nav-journal">Journal</NavLink>
              <NavLink to="/admin/outbox" data-testid="nav-outbox">Outbox</NavLink>
            </>
          )}
        </nav>
        <div className="user">
          <span title={user?.email} data-testid="current-user-name">{user?.name}</span>
          <button className="link" onClick={handleLogout} data-testid="logout-button">
            Log out
          </button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
