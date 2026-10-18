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
      <header className="topbar">
        <NavLink to="/" className="brand">
          Wallet
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Accounts
          </NavLink>
          {isMerchant && <NavLink to="/merchant/holds">Holds</NavLink>}
          {isAdmin && (
            <>
              <NavLink to="/admin/users">Users</NavLink>
              <NavLink to="/admin/journal">Journal</NavLink>
              <NavLink to="/admin/outbox">Outbox</NavLink>
            </>
          )}
        </nav>
        <div className="user">
          <span title={user?.email}>{user?.name}</span>
          <button className="link" onClick={handleLogout}>
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
