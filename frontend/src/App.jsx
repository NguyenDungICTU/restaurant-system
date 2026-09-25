import { useEffect, useState } from 'react'
import Home from './pages/Home'
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import RestaurantShell from './components/RestaurantShell'
import { getCurrentUser, logout } from './services/api'
import './App.css'

function mustChangePassword(user) {
  return Boolean(
    user?.must_change_password ??
    user?.requires_password_change ??
    user?.is_temporary_password ??
    user?.using_temporary_password ??
    false
  )
}

export default function App() {
  const [screen, setScreen] = useState('loading')
  const [user, setUser] = useState(null)

  function openAuthenticatedScreen(nextUser) {
    setUser(nextUser)
    setScreen(
      mustChangePassword(nextUser)
        ? 'change-password'
        : 'dashboard'
    )
  }

  useEffect(() => {
    getCurrentUser()
      .then(openAuthenticatedScreen)
      .catch(() => setScreen('home'))
  }, [])

  async function signOut() {
    try {
      await logout()
    } catch {
      // Phiên có thể đã hết hạn; vẫn đưa người dùng về đăng nhập.
    } finally {
      setUser(null)
      setScreen('login')
    }
  }

  if (screen === 'loading') {
    return (
      <div className="app-loading">
        <div className="loading-mark">R</div>
        <span>Đang mở hệ thống...</span>
      </div>
    )
  }

  if (screen === 'home') {
    return <Home onLogin={() => setScreen('login')} />
  }

  if (screen === 'login') {
    return (
      <Login
        onBack={() => setScreen('home')}
        onSuccess={openAuthenticatedScreen}
      />
    )
  }

  if (screen === 'change-password') {
    return (
      <ChangePassword
        user={user}
        forced={mustChangePassword(user)}
        onLogout={signOut}
        onSuccess={async (result) => {
          const shouldLogout = Boolean(
            result?.logout_required ??
            result?.requires_reauthentication ??
            result?.invalidate_current_session ??
            false
          )

          if (shouldLogout) {
            await signOut()
            return
          }

          setUser((current) => ({
            ...current,
            must_change_password: false,
            requires_password_change: false,
            is_temporary_password: false,
            using_temporary_password: false,
          }))

          setScreen('dashboard')
        }}
      />
    )
  }

  return (
    <RestaurantShell
      user={user}
      onLogout={() => {
        setUser(null)
        setScreen('home')
      }}
    />
  )
}
