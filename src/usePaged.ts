import { useCallback, useEffect, useRef, useState } from 'react'

import type { PageResponse } from './api/types'

const PAGE_SIZE = 20

/** Loads one page at a time from a paged endpoint; changing `deps` goes back to the first page. */
export function usePaged<T>(fetchPage: (page: number, size: number) => Promise<PageResponse<T>>, deps: unknown[]) {
  const [page, setPage] = useState(0)
  const [data, setData] = useState<PageResponse<T> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  // A background refresh (polling) keeps the table as it is instead of dimming it
  const silent = useRef(false)

  // The caller passes the values fetchPage depends on, like a useEffect dependency list
  const fetcher = useCallback(fetchPage, deps)

  useEffect(() => {
    setPage(0)
  }, [fetcher])

  useEffect(() => {
    let cancelled = false
    if (!silent.current) {
      setLoading(true)
      setError(null)
    }
    silent.current = false
    fetcher(page, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(null)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [fetcher, page, reloadKey])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])
  const refresh = useCallback(() => {
    silent.current = true
    setReloadKey((k) => k + 1)
  }, [])

  return { data, error, loading, page, setPage, reload, refresh }
}
