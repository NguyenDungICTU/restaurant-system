import { useEffect, useState } from 'react'
import Home from './pages/Home'
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import QuetQR from './pages/QuetQR'
import PublicMenu from './pages/PublicMenu'
import RestaurantShell from './components/RestaurantShell'
import {
  getCurrentUser,
  getSessionToken,
  logout,
  SESSION_EXPIRED_EVENT,
  setSessionToken,
} from './services/api'
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
  const [screen, setScreen] = useState(() =>
    getSessionToken() ? 'loading' : 'home'
  )
  const [user, setUser] = useState(null)
  const [loginNotice, setLoginNotice] = useState('')

  function openAuthenticatedScreen(nextUser) {
    window.history.replaceState({}, '', '/')
    setLoginNotice('')
    setUser(nextUser)
    setScreen(mustChangePassword(nextUser) ? 'change-password' : 'dashboard')
  }

  useEffect(() => {
    function handleSessionExpired(event) {
      setSessionToken(null)
      setUser(null)
      setLoginNotice(
        event.detail?.message ||
          'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
      )
      setScreen('login')
    }

    window.addEventListener(
      SESSION_EXPIRED_EVENT,
      handleSessionExpired
    )

    return () =>
      window.removeEventListener(
        SESSION_EXPIRED_EVENT,
        handleSessionExpired
      )
  }, [])

  useEffect(() => {
    // sessionStorage is deliberately tab-scoped. Do not fall back to the
    // shared browser cookie here, otherwise opening manager in another tab
    // would silently turn the service tab into manager after reload.
    if (!getSessionToken()) return
    getCurrentUser()
      .then(openAuthenticatedScreen)
      .catch((error) => {
        setSessionToken(null)
        if (error.response?.status === 401) {
          setLoginNotice(
            'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
          )
          setScreen('login')
        } else {
          setScreen('home')
        }
      })
  }, [])

  async function signOut() {
    try { await logout() } catch { setSessionToken(null) }
    finally { setUser(null); setScreen('home') }
  }

  if (screen === 'loading') return <div className="app-loading"><div className="loading-mark">R</div><span>Đang mở hệ thống...</span></div>
  if (screen === 'home') return <Home onLogin={() => setScreen('login')} onOpenMenu={() => setScreen('public-menu')} />
  if (screen === 'public-menu') return <PublicMenu onBack={() => setScreen('home')} />
  if (screen === 'login') return <Login
    notice={loginNotice}
    onBack={() => {
      setLoginNotice('')
      setScreen('home')
    }}
    onSuccess={openAuthenticatedScreen}
  />
  if (screen === 'change-password') return <ChangePassword user={user} forced={mustChangePassword(user)} onLogout={signOut} onSuccess={async () => { setSessionToken(null); setUser(null); setScreen('login') }} />

  return <RestaurantShell user={user} onLogout={() => { setUser(null); setScreen('home') }} />
}
