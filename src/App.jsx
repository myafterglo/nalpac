import { useEffect, useState } from 'react'
import TopBar from './components/TopBar'
import Sidebar from './components/Sidebar'
import CredentialsModal from './components/CredentialsModal'
import Home from './pages/Home'
import Products from './pages/Products'
import Orders from './pages/Orders'
import { loadCredentials, saveCredentials } from './credentials'
import { loadToken, requestToken, saveToken } from './token'

export default function App() {
  const [page, setPage] = useState('home')
  const [creds, setCreds] = useState(loadCredentials)
  const [token, setToken] = useState(loadToken)
  const [credentialsOpen, setCredentialsOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [tokenError, setTokenError] = useState(null)

  useEffect(() => {
    saveCredentials(creds)
  }, [creds])

  useEffect(() => {
    saveToken(token)
  }, [token])

  const hasCredentials = !!(creds.shop.trim() && creds.clientId.trim() && creds.secret.trim())

  // Throws on failure so callers (the Products page) can surface the reason.
  async function newToken() {
    setRefreshing(true)
    setTokenError(null)
    try {
      const fresh = await requestToken(creds)
      setToken(fresh)
      return fresh
    } catch (err) {
      setToken(null)
      setTokenError(err.message)
      throw err
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="app">
      <TopBar shop={creds.shop} onOpenCredentials={() => setCredentialsOpen(true)} />

      <div className="shell">
        <Sidebar page={page} onNavigate={setPage} />

        <main className="content">
          {page === 'home' && <Home onNavigate={setPage} />}
          {page === 'products' && (
            <Products
              creds={creds}
              token={token}
              newToken={newToken}
              hasCredentials={hasCredentials}
            />
          )}
          {page === 'orders' && <Orders />}
        </main>
      </div>

      {credentialsOpen && (
        <CredentialsModal
          creds={creds}
          onChange={setCreds}
          token={token}
          error={tokenError}
          onRefresh={() => newToken().catch(() => {})}
          refreshing={refreshing}
          canRefresh={hasCredentials}
          onClose={() => setCredentialsOpen(false)}
        />
      )}
    </div>
  )
}
