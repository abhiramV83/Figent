import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { API_BASE } from '../config'
import { olive, sand } from '../theme'
import logoImg from '../assets/logo.png'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [otp, setOtp] = useState('')
  const [pass, setPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Strict validation rules
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

    if (!email.trim() || !email.includes('@')) {
      return setError('Please enter a valid email address')
    }
    if (otp.trim().length !== 6) {
      return setError('Please enter a valid 6-digit recovery OTP code')
    }
    if (!isPasswordValid) {
      return setError('Password does not meet all complexity requirements')
    }
    if (!passwordsMatch) {
      return setError('Passwords do not match')
    }

    setLoading(true)
    try {
      await axios.post(`${API_BASE}/api/auth/reset-password`, { 
        email: email.trim(),
        otp: otp.trim(), 
        password: pass 
      })
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Reset failed. The OTP code may be invalid or expired.')
    } finally {
      setLoading(false)
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

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img 
            src={logoImg} 
            alt="Figent Logo" 
            style={{ width: '48px', height: '48px', margin: '0 auto 16px', display: 'block', objectFit: 'contain' }} 
          />
          <h1 style={{ color: sand[950], fontSize: '24px', fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.4px' }}>
            Set new password
          </h1>
          <p style={{ color: sand[500], fontSize: '13px', margin: 0, fontWeight: 500 }}>
            Enter your recovery details to configure a new password
          </p>
        </div>

        {/* Card */}
        <div style={{ background: sand[50], border: `1px solid ${sand[200]}`, borderRadius: '16px', padding: '28px' }}>
          
          {error && (
            <div style={{ background: '#fdf0ee', border: '1px solid #e8c4bc', borderRadius: '10px', color: '#7a2d1e', fontSize: '13px', fontWeight: 700, padding: '12px 16px', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {success ? (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', background: olive[100],
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
              }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style={{ color: olive[700] }}>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 style={{ color: sand[950], fontWeight: 800, fontSize: '16px', margin: '0 0 8px' }}>
                Password Updated
              </h3>
              <p style={{ color: sand[600], fontSize: '13px', marginBottom: '20px', lineHeight: 1.5 }}>
                Your new password has been successfully configured. You can now log in.
              </p>
              <button onClick={() => navigate('/login')} style={{
                width: '100%', background: olive[600], color: '#f7f9eb', border: 'none', borderRadius: '10px',
                padding: '12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
              }}>
                Go to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Email Address */}
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

              {/* 6-Digit OTP */}
              <div>
                <label style={{ display: 'block', color: sand[700], fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  6-Digit Reset OTP Code
                </label>
                <input
                  required
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); if (error) setError(''); }}
                  placeholder="123456"
                  onFocus={e => e.target.style.borderColor = olive[400]}
                  onBlur={e => e.target.style.borderColor = sand[200]}
                  style={{
                    width: '100%', background: sand[100], border: `1px solid ${sand[200]}`,
                    borderRadius: '10px', padding: '11px 14px', fontSize: '16px',
                    color: sand[950], outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box',
                    fontWeight: 700, transition: 'border-color 0.15s', letterSpacing: '0.25em', textAlign: 'center'
                  }}
                />
              </div>
              
              {/* Password Input */}
              <div>
                <label style={{ display: 'block', color: sand[700], fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    value={pass}
                    onChange={e => { setPass(e.target.value); if (error) setError(''); }}
                    placeholder="New password"
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
                  Confirm New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    required
                    type="password"
                    value={confirmPass}
                    onChange={e => { setConfirmPass(e.target.value); if (error) setError(''); }}
                    placeholder="Confirm new password"
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
                {loading ? 'Updating password...' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
