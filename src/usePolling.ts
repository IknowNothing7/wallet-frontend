import { useEffect } from 'react'

/** Calls `tick` every `intervalMs` while `active` is true and the tab is visible. */
export function usePolling(active: boolean, tick: () => void, intervalMs = 3000) {
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') tick()
    }, intervalMs)
    return () => clearInterval(id)
  }, [active, tick, intervalMs])
}
