import { useState, type FormEvent } from 'react'

import { userApi } from '../../api/endpoints'
import type { User, UserSearch, UserSortField } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { DataTable, ErrorMessage, Pager, StatusBadge } from '../../components/ui'
import { formatDate } from '../../format'
import { usePaged } from '../../usePaged'

export function UsersPage() {
  const { user: me } = useAuth()
  const [search, setSearch] = useState<UserSearch>({})
  const [keyword, setKeyword] = useState('')
  const { data, error, loading, setPage, refresh } = usePaged(
    (page, size) => userApi.list(search, page, size),
    [search.keyword, search.sortField],
  )
  const [changing, setChanging] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSearch((s) => ({ ...s, keyword: keyword.trim() || undefined }))
  }

  const toggleMerchant = async (user: User) => {
    setChanging(user.id)
    setActionError(null)
    try {
      await userApi.changeRole(user.id, user.role === 'MERCHANT' ? 'USER' : 'MERCHANT')
      refresh()
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setChanging(null)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p className="muted">
            Make a user a merchant so they can place holds, or turn them back into a regular user. The admin role can't
            be granted here.
          </p>
        </div>
      </div>

      <form className="inline-form action-form" onSubmit={submit}>
        <input
          type="search"
          placeholder="Name or email"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          maxLength={100}
          aria-label="Search by name or email"
        />
        <select
          value={search.sortField ?? ''}
          onChange={(e) => setSearch((s) => ({ ...s, sortField: (e.target.value || undefined) as UserSortField }))}
          aria-label="Sort by"
        >
          <option value="">Sort by number</option>
          <option value="NAME">Sort by name</option>
          <option value="EMAIL">Sort by email</option>
        </select>
        <button type="submit">Search</button>
      </form>
      <ErrorMessage error={actionError} />

      <DataTable
        columns={['#', 'Name', 'Email', 'Role', 'Joined', '']}
        rows={data?.content}
        loading={loading}
        error={error}
        empty={search.keyword ? `No users match “${search.keyword}”.` : 'No users.'}
        rowKey={(u) => u.id}
        renderRow={(u) => (
          <>
            <td>{u.id}</td>
            <td>
              {u.name}
              {u.id === me?.id && <span className="muted"> (you)</span>}
            </td>
            <td>{u.email}</td>
            <td>
              <StatusBadge status={u.role} />
            </td>
            <td>{formatDate(u.createdAt)}</td>
            <td className="actions">
              {u.role !== 'ADMIN' && (
                <button disabled={changing === u.id} onClick={() => toggleMerchant(u)}>
                  {changing === u.id ? 'Saving…' : u.role === 'MERCHANT' ? 'Make user' : 'Make merchant'}
                </button>
              )}
            </td>
          </>
        )}
      />
      <Pager data={data} onPage={setPage} />
    </>
  )
}
