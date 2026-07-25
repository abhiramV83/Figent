import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import axios from 'axios'
import { API_BASE } from './config'
import Home from './pages/Home'
import Review from './pages/Review'
import History from './pages/History'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Landing from './pages/Landing'
import Navbar from './components/Navbar'

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [username, setUsername] = useState(localStorage.getItem('username') || '')
  const [loadingGuest, setLoadingGuest] = useState(!token)

  const handleLogin = (tok, uname) => {
    localStorage.setItem('token', tok)
    if (uname) localStorage.setItem('username', uname)
    setToken(tok)
    if (uname) setUsername(uname)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    setToken('')
    setUsername('')
  }

  useEffect(() => {
    if (!token) {
      setLoadingGuest(true)
      axios.post(`${API_BASE}/api/auth/guest`)
        .then(res => {
          handleLogin(res.data.token, res.data.username)
          setLoadingGuest(false)
        })
        .catch(err => {
          console.error('Failed to create guest session', err)
          setLoadingGuest(false)
        })
    } else {
      setLoadingGuest(false)
    }
  }, [token])

  const ProtectedRoute = ({ children }) => {
    if (!token) return <Navigate to="/login" replace />
    return (
      <div style={{ minHeight: '100vh', background: '#f5f3ec', display: 'flex', flexDirection: 'column' }}>
        <Navbar user={{ username }} onLogout={handleLogout} />
        <main style={{ flex: 1 }}>
          {children}
        </main>
      </div>
    )
  }

  if (loadingGuest) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f3ec', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            border: '2.5px solid #e5e3d9',
            borderTopColor: '#4a5c2d',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }}></div>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
          <div style={{ fontSize: '13px', color: '#524f46', fontWeight: 700, letterSpacing: '-0.1px' }}>
            Initializing free guest workspace...
          </div>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth pages */}
        <Route
          path="/login"
          element={token ? <Navigate to="/" replace /> : <Login onLogin={(tok, uname) => handleLogin(tok, uname)} />}
        />
        <Route
          path="/register"
          element={token ? <Navigate to="/" replace /> : <Register onLogin={(tok, uname) => handleLogin(tok, uname)} />}
        />
        <Route
          path="/forgot-password"
          element={token ? <Navigate to="/" replace /> : <ForgotPassword />}
        />
        <Route
          path="/reset-password"
          element={token ? <Navigate to="/" replace /> : <ResetPassword />}
        />

        {/* Authenticated / Welcome routes */}
        <Route
          path="/"
          element={<ProtectedRoute><Home token={token} onAuthError={handleLogout} /></ProtectedRoute>}
        />
        <Route path="/review/:id" element={<ProtectedRoute><Review token={token} onAuthError={handleLogout} /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><History token={token} onAuthError={handleLogout} /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}