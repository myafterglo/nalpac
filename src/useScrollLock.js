import { useEffect } from 'react'

// Overlays can stack (a raw-JSON modal over the search drawer), so count them
// and only restore the page once the last one closes.
let openCount = 0
let restore = ''

/** Stops the page behind an overlay from scrolling while it is open. */
export function useScrollLock() {
  useEffect(() => {
    if (openCount === 0) {
      restore = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    openCount += 1

    return () => {
      openCount -= 1
      if (openCount === 0) document.body.style.overflow = restore
    }
  }, [])
}
