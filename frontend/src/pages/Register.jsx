import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { API_BASE } from '../config'
import { olive, sand } from '../theme'
import logoImg from '../assets/logo.png'

export default function Register({ onLogin }) {
  const [user, setUser] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [showOtp, setShowOtp] = useState(false)
  const [otp, setOtp] = useState('')
  const navigate = useNavigate()

  // Password strict checks helper
  const validationRules = {
    length: pass.length >= 8,
    uppercase: /[A-Z]/.test(pass),
    lowercase: /[a-z]/.test(pass),
    number: /[0-9]/.test(pass),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(pass)
  }

  const isPasswordValid = Object.values(validationRules).every(rule => rule)
  const passwordsMatch = pass && pass === confirmPass

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (user.trim().length < 3) {
      return setError('Username must be at least 3 characters')
    }
    if (!email.trim() || !email.includes('@')) {
      return setError('Please enter a valid email address')
    }
    if (!isPasswordValid) {
      return setError('Password does not meet all complexity requirements')
    }
    if (!passwordsMatch) {
      return setError('Passwords do not match')
    }

    setLoading(true)
    try {
      await axios.post(`${API_BASE}/api/auth/register`, { 
        username: user, 
        password: pass,
        email: email
      })
      setShowOtp(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Try a different username/email.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')

    if (otp.trim().length !== 6) {
      return setError('Please enter a valid 6-digit OTP code')
    }

    setLoading(true)
    try {
      const res = await axios.post(`${API_BASE}/api/auth/verify-email`, {
        email: email,
        otp: otp.trim()
      })
      onLogin(res.data.token, res.data.username)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Verification failed. The code may be invalid or expired.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    setError('')
    setSuccessMsg('')
    try {
      await axios.post(`${API_BASE}/api/auth/register`, { 
        username: user, 
        password: pass,
        email: email
      })
      setSuccessMsg('A new 6-digit verification code has been sent!')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend verification code.')
    }
  }

  const RuleIndicator = ({ met, text }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: met ? olive[700] : sand[500], fontWeight: 600 }}>
      {met ? (
        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" style={{ color: olive[600] }}>
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ) : (
        <div style={{ width: 10, height: 10, borderRadius: '50%', border: `1.5px solid ${sand[400]}`, boxSizing: 'border-box' }} />
      )}
      <span>{text}</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: sand.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '390px' }}>

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
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img 
            src={logoImg} 
            alt="Figent Logo" 
            style={{ width: '48px', height: '48px', margin: '0 auto 16px', display: 'block', objectFit: 'contain' }} 
          />
          <h1 style={{ color: sand[950], fontSize: '24px', fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.4px' }}>
            {showOtp ? 'Verify email' : 'Create account'}
          </h1>
          <p style={{ color: sand[500], fontSize: '13px', margin: 0, fontWeight: 500 }}>
            {showOtp ? `We sent an OTP code to ${email}` : 'Start reviewing repositories on Figent'}
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
            <div style={{ background: olive[50], border: `1px solid ${olive[200]}`, borderRadius: '10px', color: olive[800], fontSize: '13px', fontWeight: 700, padding: '12px 16px', marginBottom: '20px', animation: 'slideIn 0.22s ease-out both' }}>
              {successMsg}
            </div>
          )}

          {showOtp ? (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', color: sand[700], fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  6-Digit Verification Code
                </label>
                <input
                  required
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); if (error) setError(''); }}
                  placeholder="123456"
                  style={{
                    width: '100%', background: sand[100], border: `1px solid ${sand[200]}`,
                    borderRadius: '10px', padding: '12px 14px', fontSize: '18px',
                    color: sand[950], outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box',
                    fontWeight: 700, transition: 'border-color 0.15s', letterSpacing: '0.35em', textAlign: 'center'
                  }}
                  onFocus={e => e.target.style.borderColor = olive[400]}
                  onBlur={e => e.target.style.borderColor = sand[200]}
                />
              </div>

              <button type="submit" disabled={loading} style={{
                width: '100%', background: loading ? sand[300] : olive[600],
                color: '#f7f9eb', border: 'none', borderRadius: '10px',
                padding: '12px', fontSize: '13px', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.2s'
              }}>
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginTop: '6px' }}>
                <button type="button" onClick={() => setShowOtp(false)} style={{
                  background: 'none', border: 'none', color: sand[600], cursor: 'pointer', fontWeight: 700, padding: 0, textDecoration: 'underline'
                }}>
                  Edit Signup Info
                </button>
                <button type="button" onClick={handleResendOtp} style={{
                  background: 'none', border: 'none', color: olive[600], cursor: 'pointer', fontWeight: 700, padding: 0, textDecoration: 'underline'
                }}>
                  Resend Code
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Username Input */}
              <div>
                <label style={{ display: 'block', color: sand[700], fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Username
                </label>
                <input
                  required
                  type="text"
                  value={user}
                  onChange={e => { setUser(e.target.value); if (error) setError(''); }}
                  placeholder="Choose username"
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

              {/* Email Input */}
              <div>
                <label style={{ display: 'block', color: sand[700], fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (error) setError(''); }}
                  placeholder="you@example.com"
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

              {/* Password Input */}
              <div>
                <label style={{ display: 'block', color: sand[700], fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    value={pass}
                    onChange={e => { setPass(e.target.value); if (error) setError(''); }}
                    placeholder="Password"
                    onFocus={e => e.target.style.borderColor = olive[400]}
                    onBlur={e => e.target.style.borderColor = sand[200]}
                    style={{
                      width: '100%', background: sand[100], border: `1px solid ${sand[200]}`,
                      borderRadius: '10px', padding: '11px 40px 11px 14px', fontSize: '13px',
                      color: sand[950], outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                      fontWeight: 600, transition: 'border-color 0.15s'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: sand[600],
                      padding: '4px', display: 'flex', alignItems: 'center'
                    }}
                  >
                    {showPassword ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Password complexity checker */}
                <div style={{ 
                  marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', 
                  background: sand[100], borderRadius: '8px', padding: '8px 12px', border: `1px solid ${sand[200]}`
                }}>
                  <RuleIndicator met={validationRules.length} text="At least 8 characters" />
                  <RuleIndicator met={validationRules.uppercase} text="Contains uppercase letter (A-Z)" />
                  <RuleIndicator met={validationRules.lowercase} text="Contains lowercase letter (a-z)" />
                  <RuleIndicator met={validationRules.number} text="Contains number (0-9)" />
                  <RuleIndicator met={validationRules.special} text="Contains special character (!@#$%...)" />
                </div>
              </div>

              {/* Confirm Password Input */}
              <div>
                <label style={{ display: 'block', color: sand[700], fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Confirm Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    required
                    type="password"
                    value={confirmPass}
                    onChange={e => { setConfirmPass(e.target.value); if (error) setError(''); }}
                    placeholder="Confirm password"
                    onFocus={e => e.target.style.borderColor = olive[400]}
                    onBlur={e => e.target.style.borderColor = sand[200]}
                    style={{
                      width: '100%', background: sand[100], border: `1px solid ${sand[200]}`,
                      borderRadius: '10px', padding: '11px 14px', fontSize: '13px',
                      color: sand[950], outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                      fontWeight: 600, transition: 'border-color 0.15s'
                    }}
                  />
                  {confirmPass && (
                    <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                      {passwordsMatch ? (
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style={{ color: olive[600] }}>
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#7a2d1e', fontWeight: 700 }}>Mismatch</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <button type="submit" disabled={loading} style={{
                width: '100%', background: loading ? sand[300] : olive[600],
                color: '#f7f9eb', border: 'none', borderRadius: '10px',
                padding: '12px', fontSize: '13px', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.2s',
                marginTop: '6px'
              }}>
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', color: sand[500], fontSize: '13px', marginTop: '20px' }}>
          Already have an account?{' '}
          <button onClick={() => navigate('/login')} style={{
            background: 'none', border: 'none', color: olive[600], cursor: 'pointer',
            fontWeight: 700, fontSize: '13px', padding: 0, textDecoration: 'underline', textUnderlineOffset: '3px'
          }}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}
