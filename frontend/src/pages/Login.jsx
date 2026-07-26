import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { API_BASE } from '../config'
import { olive, sand } from '../theme'
import logoImg from '../assets/logo.png'

export default function Login({ onLogin }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleGithubLogin = () => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID
    if (!clientId) {
      setError('GitHub Client ID is not configured in environment settings.')
      return
    }
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback')
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=read:user,user:email`
    window.location.href = githubUrl
  }

  const handleGuestLogin = () => {
    setLoading(true)
    setError('')
    axios.post(`${API_BASE}/api/auth/guest`)
      .then(res => {
        onLogin(res.data.token, res.data.username)
        navigate('/')
      })
      .catch(err => {
        setError(err.response?.data?.detail || 'Failed to initialize free workspace')
        setLoading(false)
      })
  }

  return (
    <div style={{ minHeight: '100vh', background: sand.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>

        {/* Back Link to Welcome page */}
        <button onClick={() => navigate('/')} style={{
          background: 'none', border: 'none', color: sand[600],
          fontSize: '12px', cursor: 'pointer', marginBottom: '24px', padding: 0,
          display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Welcome Page
        </button>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img 
            src={logoImg} 
            alt="Figent Logo" 
            style={{ width: '48px', height: '48px', margin: '0 auto 16px', display: 'block', objectFit: 'contain' }} 
          />
          <h1 style={{ color: sand[950], fontSize: '24px', fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.4px' }}>
            Welcome back
          </h1>
          <p style={{ color: sand[500], fontSize: '13px', margin: 0, fontWeight: 500 }}>
            Sign in to your Figent workspace
          </p>
        </div>

        {/* Card */}
        <div style={{ background: sand[50], border: `1px solid ${sand[200]}`, borderRadius: '16px', padding: '32px' }}>
          
          {error && (
            <div style={{ 
              background: '#fdf0ee', border: '1px solid #e8c4bc', 
              borderRadius: '10px', color: '#7a2d1e', fontSize: '13px', 
              fontWeight: 700, padding: '12px 16px', marginBottom: '20px' 
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* GitHub Login Button */}
            <button
              disabled={loading}
              onClick={handleGithubLogin}
              style={{
                width: '100%',
                background: '#1f2328',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '13px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#2f353c' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = '#1f2328' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/>
              </svg>
              Continue with GitHub
            </button>

            {/* Separator line */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0' }}>
              <div style={{ flex: 1, height: '1px', background: sand[200] }}></div>
              <span style={{ padding: '0 10px', color: sand[400], fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: sand[200] }}></div>
            </div>

            {/* Guest Login Button */}
            <button
              disabled={loading}
              onClick={handleGuestLogin}
              style={{
                width: '100%',
                background: sand[100],
                color: sand[800],
                border: `1px solid ${sand[300]}`,
                borderRadius: '10px',
                padding: '12px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = sand[200] }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = sand[100] }}
            >
              {loading ? 'Initializing...' : 'Continue as Guest (Free)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
