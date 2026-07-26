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
import Callback from './pages/Callback'

export default function App() {
  // Trigger rebuild to inject newly added Vercel environment variables
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [username, setUsername] = useState(localStorage.getItem('username') || '')

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
          element={
            token ? (
              <ProtectedRoute><Home token={token} onAuthError={handleLogout} /></ProtectedRoute>
            ) : (
              <Landing />
            )
          }
        />
        <Route path="/review/:id" element={<ProtectedRoute><Review token={token} onAuthError={handleLogout} /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><History token={token} onAuthError={handleLogout} /></ProtectedRoute>} />
        <Route path="/auth/callback" element={<Callback onLogin={(tok, uname) => handleLogin(tok, uname)} />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}