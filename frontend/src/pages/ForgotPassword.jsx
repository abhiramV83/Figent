import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { API_BASE } from '../config'
import { olive, sand } from '../theme'
import logoImg from '../assets/logo.png'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (!email.trim() || !email.includes('@')) {
      return setError('Please enter a valid email address')
    }

    setLoading(true)
    try {
      const res = await axios.post(`${API_BASE}/api/auth/forgot-password`, { email })
      setSuccessMsg('Verification OTP code sent! Redirecting to password reset page...')
      setTimeout(() => {
        navigate(`/reset-password?email=${encodeURIComponent(email)}`)
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.detail || 'Request failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: sand.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>

        {/* Back Link to Login */}
        <button onClick={() => navigate('/login')} style={{
          background: 'none', border: 'none', color: sand[600],
          fontSize: '12px', cursor: 'pointer', marginBottom: '24px', padding: 0,
          display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Login
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img 
            src={logoImg} 
            alt="Figent Logo" 
            style={{ width: '48px', height: '48px', margin: '0 auto 16px', display: 'block', objectFit: 'contain' }} 
          />
          <h1 style={{ color: sand[950], fontSize: '24px', fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.4px' }}>
            Reset password
          </h1>
          <p style={{ color: sand[500], fontSize: '13px', margin: 0, fontWeight: 500 }}>
            Enter your email to receive a recovery OTP code
          </p>
        </div>

        {/* Card */}
        <div style={{ background: sand[50], border: `1px solid ${sand[200]}`, borderRadius: '16px', padding: '28px' }}>
          
          {error && (
            <div style={{ background: '#fdf0ee', border: '1px solid #e8c4bc', borderRadius: '10px', color: '#7a2d1e', fontSize: '13px', fontWeight: 700, padding: '12px 16px', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {successMsg && (
            <div style={{ 
              background: olive[50], border: `1px solid ${olive[200]}`, 
              borderRadius: '10px', color: olive[800], fontSize: '13px', 
              padding: '16px', lineHeight: 1.5, textAlign: 'center'
            }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{successMsg}</p>
            </div>
          )}

          {!successMsg && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', color: sand[700], fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (error) setError(''); }}
                  placeholder="Enter your email"
                  onFocus={e => e.target.style.borderColor = olive[400]}
                  onBlur={e => e.target.style.borderColor = sand[200]}
                  style={{
                    width: '100%', background: sand[100], border: `1px solid ${sand[200]}`,
                    borderRadius: '10px', padding: '11px 14px', fontSize: '13px',
                    color: sand[950], outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                    fontWeight: 600, transition: 'border-color 0.15s'
                  }}
                />
              </div>

              <button type="submit" disabled={loading} style={{
                width: '100%', background: loading ? sand[300] : olive[600],
                color: '#f7f9eb', border: 'none', borderRadius: '10px',
                padding: '12px', fontSize: '13px', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.2s',
                marginTop: '6px'
              }}>
                {loading ? 'Sending OTP...' : 'Send OTP code'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
