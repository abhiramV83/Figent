import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { API_BASE } from '../config'
import { olive, sand } from '../theme'
import logoImg from '../assets/logo.png'

export default function Login({ onLogin }) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (user.trim().length < 3) {
      setError('Username must be at least 3 characters')
      return
    }
    if (pass.length < 4) {
      setError('Password must be at least 4 characters')
      return
    }

    setLoading(true)
    try {
      const res = await axios.post(`${API_BASE}/api/auth/login`, { username: user, password: pass })
      onLogin(res.data.token, res.data.username)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  const handleUserChange = (e) => {
    setUser(e.target.value)
    if (error) setError('')
  }

  const handlePassChange = (e) => {
    setPass(e.target.value)
    if (error) setError('')
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

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            
            {/* Username Input */}
            <div>
              <label style={{ display: 'block', color: sand[700], fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                Username
              </label>
              <input
                required
                type="text"
                value={user}
                onChange={handleUserChange}
                placeholder="Enter username"
                onFocus={e => e.target.style.borderColor = olive[400]}
                onBlur={e => e.target.style.borderColor = sand[200]}
                style={{
                  width: '100%', background: sand[100], border: `1px solid ${sand[200]}`,
                  borderRadius: '10px', padding: '12px 16px', fontSize: '14px',
                  color: sand[950], outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                  fontWeight: 600, transition: 'border-color 0.15s'
                }}
              />
            </div>

            {/* Password Input */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ display: 'block', color: sand[700], fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  style={{
                    background: 'none', border: 'none', color: olive[600], cursor: 'pointer',
                    fontWeight: 700, fontSize: '11px', padding: 0, textDecoration: 'underline', textUnderlineOffset: '2px'
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={pass}
                  onChange={handlePassChange}
                  placeholder="••••••••"
                  onFocus={e => e.target.style.borderColor = olive[400]}
                  onBlur={e => e.target.style.borderColor = sand[200]}
                  style={{
                    width: '100%', background: sand[100], border: `1px solid ${sand[200]}`,
                    borderRadius: '10px', padding: '12px 48px 12px 16px', fontSize: '14px',
                    color: sand[950], outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                    fontWeight: 600, transition: 'border-color 0.15s'
                  }}
                />
                
                {/* Toggle show/hide button */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: sand[600],
                    padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              width: '100%', background: loading ? sand[300] : olive[600],
              color: '#f7f9eb', border: 'none', borderRadius: '10px',
              padding: '13px', fontSize: '14px', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.2s',
              marginTop: '8px'
            }}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: sand[500], fontSize: '13px', marginTop: '20px' }}>
          No account?{' '}
          <button onClick={() => navigate('/register')} style={{
            background: 'none', border: 'none', color: olive[600], cursor: 'pointer',
            fontWeight: 700, fontSize: '13px', padding: 0, textDecoration: 'underline', textUnderlineOffset: '3px'
          }}>
            Create one
          </button>
        </p>
      </div>
    </div>
  )
}
