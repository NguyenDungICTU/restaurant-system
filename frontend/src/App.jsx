import { useEffect, useState } from 'react'
import Home from './pages/Home'
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import QuetQR from './pages/QuetQR'
import PublicMenu from './pages/PublicMenu'
import PublicBooking from './pages/PublicBooking'
import RestaurantShell from './components/RestaurantShell'
import { getCurrentUser, getSessionToken, logout, setSessionToken } from './services/api'
import './App.css'

function mustChangePassword(user) {
  return Boolean(user?.must_change_password ?? false)
}

export default function App() {
  const token = new URLSearchParams(window.location.search).get('qr')
  if (token !== null) return <QuetQR token={token} />
  return <AuthenticatedApp />
}

function AuthenticatedApp() {
  const [screen, setScreen] = useState('loading')
  const [user, setUser] = useState(null)

  function openAuthenticatedScreen(nextUser) {
    window.history.replaceState({}, '', '/')
    setUser(nextUser)
    setScreen(mustChangePassword(nextUser) ? 'change-password' : 'dashboard')
  }

  useEffect(() => {
    // sessionStorage is deliberately tab-scoped. Do not fall back to the
    // shared browser cookie here, otherwise opening manager in another tab
    // would silently turn the service tab into manager after reload.
    if (!getSessionToken()) {
      setScreen('home')
      return
    }
    getCurrentUser()
      .then(openAuthenticatedScreen)
      .catch(() => {
        setSessionToken(null)
        setScreen('home')
      })
  }, [])

  async function signOut() {
    try { await logout() } catch { setSessionToken(null) }
    finally { setUser(null); setScreen('home') }
  }

  if (screen === 'loading') return <div className="app-loading"><div className="loading-mark">R</div><span>Đang mở hệ thống...</span></div>
  if (screen === 'home') return <Home onLogin={() => setScreen('login')} onOpenMenu={() => setScreen('public-menu')} onOpenBooking={() => setScreen('public-booking')} />
  if (screen === 'public-menu') return <PublicMenu onBack={() => setScreen('home')} />
  if (screen === 'public-booking') return <PublicBooking onBack={() => setScreen('home')} />
  if (screen === 'login') return <Login onBack={() => setScreen('home')} onSuccess={openAuthenticatedScreen} />
  if (screen === 'change-password') return <ChangePassword user={user} forced={mustChangePassword(user)} onLogout={signOut} onSuccess={async () => { setSessionToken(null); setUser(null); setScreen('login') }} />

  return <RestaurantShell user={user} onLogout={() => { setUser(null); setScreen('home') }} />
}
