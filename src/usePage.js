import { useEffect, useState } from 'react'

export const PAGES = ['home', 'products', 'orders', 'nalpac-orders', 'carriers']

const HOME = 'home'

function fromPath() {
  const id = window.location.pathname.replace(/^\/+|\/+$/g, '')
  if (!id) return HOME
  return PAGES.includes(id) ? id : HOME
}

/**
 * Keeps the current page in the URL path so a refresh — or the back button —
 * lands where you were rather than on Home. Needs the server to serve
 * index.html for unknown paths; Vite's dev server does this by default.
 */
export function usePage() {
  const [page, setPage] = useState(fromPath)

  useEffect(() => {
    const onPopState = () => setPage(fromPath())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function navigate(id) {
    // pushState doesn't fire popstate, so the state is set here too.
    if (fromPath() !== id) window.history.pushState(null, '', id === HOME ? '/' : `/${id}`)
    setPage(id)
  }

  return [page, navigate]
}
