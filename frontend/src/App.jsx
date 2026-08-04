import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import axios from 'axios'
import { API_BASE } from './config'
import Home from './pages/Home'
import Review from './pages/Review'
import History from './pages/History'
import Login from './pages/Login'
import Landing from './pages/Landing'
import Navbar from './components/Navbar'
import Callback from './pages/Callback'
import Profile from './pages/Profile'
import Footer from './components/Footer'
import Support from './pages/Support'

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
      <div style={{ 
        minHeight: '100vh', 
        background: '#f5f3ec', 
        backgroundImage: 'radial-gradient(rgba(122, 133, 90, 0.16) 1.5px, transparent 0)',
        backgroundSize: '24px 24px',
        display: 'flex', 
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Background Blobs Layer */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 0
        }}>
          <div style={{
            position: 'absolute', top: '-10%', left: '-10%',
            width: '50vw', height: '50vw', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(122, 133, 90, 0.1) 0%, rgba(245, 243, 236, 0) 70%)',
            filter: 'blur(60px)',
            animation: 'drift-bg 22s infinite alternate ease-in-out'
          }} />
          <div style={{
            position: 'absolute', bottom: '-15%', right: '-10%',
            width: '60vw', height: '60vw', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(185, 195, 160, 0.12) 0%, rgba(245, 243, 236, 0) 70%)',
            filter: 'blur(80px)',
            animation: 'drift-bg-rev 28s infinite alternate ease-in-out'
          }} />
        </div>

        <Navbar user={{ username }} onLogout={handleLogout} />
        <main style={{ flex: 1, zIndex: 1, position: 'relative', paddingBottom: '58px' }}>
          {children}
        </main>
        <Footer />

        <style>{`
          @keyframes drift-bg {
            from { transform: translate(0, 0) scale(1); }
            to { transform: translate(6%, 6%) scale(1.08); }
          }
          @keyframes drift-bg-rev {
            from { transform: translate(0, 0) scale(1); }
            to { transform: translate(-6%, -6%) scale(1.05); }
          }
        `}</style>
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

        {/* Authenticated / Welcome routes */}
        <Route
          path="/"
          element={
            token ? (
              <ProtectedRoute><Home token={token} username={username} onAuthError={handleLogout} /></ProtectedRoute>
            ) : (
              <Landing />
            )
          }
        />
        <Route path="/review/:id" element={<ProtectedRoute><Review token={token} username={username} onAuthError={handleLogout} /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><History token={token} onAuthError={handleLogout} /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile token={token} onAuthError={handleLogout} /></ProtectedRoute>} />
        <Route path="/support" element={<ProtectedRoute><Support token={token} onAuthError={handleLogout} /></ProtectedRoute>} />
        <Route path="/auth/callback" element={<Callback onLogin={(tok, uname) => handleLogin(tok, uname)} />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}